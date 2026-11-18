// Every write path: gate, validate everything, write, read back, compare. Callers get the mismatches back.
import { CMD, exchange, readBlock } from './transport/device.js';
import { encodeKey } from './codecs/key.js';
import { CHANGED, validateFunc } from './codecs/func.js';
import { COLOR_AREA, colorOffset, encodeColor, isColor } from './codecs/colors.js';
import { LAYERS, MATRIX_STRIDE, matrixOffset, encodeEntry, isWritableEntry } from './codecs/matrix.js';

/**
 * @param {HIDDevice} dev
 * @param {{name: string, verified: boolean, limits: Record<string, [number, number]>}} model
 * @param {{assertCanWrite: (m: any) => void}} gate
 * @param {Map<number, any>} want row -> full key struct
 * @param {(msg: string) => void} [progress]
 * @returns {Promise<{keysHex: number[], bad: number[]}>}
 */
export async function writeKeys(dev, model, gate, want, progress = () => {}) {
  gate.assertCanWrite(model);
  for (const [row, k] of want) { // validate everything before the first write
    for (const [f, [lo, hi]] of Object.entries(model.limits)) {
      if (!Number.isInteger(k[f]) || k[f] < lo || k[f] > hi) throw new Error(`key ${row}: ${f} must be a whole number ${lo}-${hi}`);
    }
  }
  let n = 0;
  for (const [row, k] of want) { progress(`Writing key ${row} (${++n}/${want.size})...`); await exchange(dev, CMD.KEY_SET, 8 * row, 8, encodeKey(k)); }
  const keysHex = await readBlock(dev, CMD.KEY_GET, 0, 1024);
  const bad = [...want].filter(([row, k]) => encodeKey(k).some((b, i) => b !== keysHex[row * 8 + i])).map(([row]) => row);
  return { keysHex, bad };
}

/**
 * Whole 64-byte block like the official app: last chunk re-sent from offset 8 so every packet is full.
 * @param {HIDDevice} dev @param {{name: string, verified: boolean}} model
 * @param {{assertCanWrite: (m: any) => void}} gate @param {number[]} next @param {number} deb requested debounce level
 */
export async function writeFunc(dev, model, gate, next, deb) {
  gate.assertCanWrite(model);
  validateFunc(next, deb);
  await exchange(dev, CMD.FUNC_SET, 0, 56, next.slice(0, 56));
  await exchange(dev, CMD.FUNC_SET, 8, 56, next.slice(8, 64));
  const back = await readBlock(dev, CMD.FUNC_GET, 0, 64);
  return { back, bad: CHANGED.filter(i => back[i] !== next[i]) };
}

/**
 * Remap one key on profile 0. Reads the whole layer before and after, so any other key that moved is reported too.
 * @param {HIDDevice} dev
 * @param {{name: string, verified: boolean, matrixKeys: number, keymap: [number, string][]}} model
 * @param {{assertCanWrite: (m: any) => void}} gate
 * @param {{layer: number, key: number, entry: {type: number, code1: number, code2: number}}} change
 * @returns {Promise<{before: number[], after: number[], bad: number[]}>} bad = byte indexes in the layer that differ from the expectation
 */
export async function writeMatrixKey(dev, model, gate, { layer, key, entry }) {
  gate.assertCanWrite(model);
  if (!Number.isInteger(layer) || layer < 0 || layer >= LAYERS) throw new Error(`layer must be 0-${LAYERS - 1}`);
  if (!model.keymap.some(([row]) => row === key)) throw new Error(`key row ${key} is not a named key`);
  if (!isWritableEntry(entry)) throw new Error(`entry ${JSON.stringify(entry)} is not allowed`);
  const at = MATRIX_STRIDE * layer, size = 3 * model.matrixKeys;
  const before = await readBlock(dev, CMD.MATRIX, at, size);
  await exchange(dev, CMD.MATRIX_SET, matrixOffset(layer, key), 3, encodeEntry(entry));
  const after = await readBlock(dev, CMD.MATRIX, at, size);
  const want = before.slice();
  want.splice(3 * key, 3, ...encodeEntry(entry));
  return { before, after, bad: after.flatMap((b, i) => (b === want[i] ? [] : [i])) };
}

/**
 * Make another profile the one the keyboard uses: read the base block (cmd 4), change only byte 0, write it back (cmd 14), read it again.
 * @param {HIDDevice} dev @param {{name: string, verified: boolean, profiles: number}} model
 * @param {{assertCanWrite: (m: any) => void}} gate @param {number} profile
 * @returns {Promise<{before: number[], after: number[], bad: number[]}>} bad = byte indexes that differ from the expectation
 */
export async function writeActiveProfile(dev, model, gate, profile) {
  gate.assertCanWrite(model);
  const before = await readBlock(dev, CMD.BASE_GET, 0, 56);
  const count = before[1], order = before.slice(2, 2 + count);
  if (!Number.isInteger(profile) || profile < 0 || profile >= model.profiles) throw new Error(`profile must be 0-${model.profiles - 1}`);
  if (count !== model.profiles || !order.includes(profile)) throw new Error(`unexpected base block (${count} profiles, order ${order.join(',')}): not writing`);
  const want = before.slice();
  want[0] = order.indexOf(profile);
  await exchange(dev, CMD.BASE_SET, 0, want.length, want);
  const after = await readBlock(dev, CMD.BASE_GET, 0, 56);
  return { before, after, bad: after.flatMap((b, i) => (b === want[i] ? [] : [i])) };
}

/**
 * Paint keys on profile 0: one 3-byte cmd 11 write per key, then the whole colour table is read back (cmd 10).
 * @param {HIDDevice} dev @param {{name: string, verified: boolean, keymap: [number, string][]}} model
 * @param {{assertCanWrite: (m: any) => void}} gate @param {Map<number, {r: number, g: number, b: number}>} want row -> colour
 * @param {(msg: string) => void} [progress]
 * @returns {Promise<{back: number[], bad: number[]}>} bad = key rows whose stored colour differs from the request
 */
export async function writeColors(dev, model, gate, want, progress = () => {}) {
  gate.assertCanWrite(model);
  for (const [row, c] of want) { // validate everything before the first write
    if (!model.keymap.some(([r]) => r === row)) throw new Error(`key row ${row} is not a named key`);
    if (!isColor(c)) throw new Error(`key ${row}: colour must be three whole numbers 0-255`);
  }
  let n = 0;
  for (const [row, c] of want) { progress(`Painting key ${row} (${++n}/${want.size})...`); await exchange(dev, CMD.LIGHT_SET, colorOffset(0, row), 3, encodeColor(c)); }
  const back = await readBlock(dev, CMD.LIGHT_GET, 0, COLOR_AREA);
  const bad = [...want].filter(([row, c]) => encodeColor(c).some((b, i) => b !== back[3 * row + i])).map(([row]) => row);
  return { back, bad };
}
