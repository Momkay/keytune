// Validates an imported backup file before any of it is used. Nothing here touches the keyboard.
import { decodeKey } from '../codecs/key.js';
import { COLOR_AREA, decodeColors } from '../codecs/colors.js';
import { validateFunc } from '../codecs/func.js';

const isBytes = (/** @type {unknown} */ a, /** @type {number} */ n) =>
  Array.isArray(a) && a.length === n && a.every(v => Number.isInteger(v) && v >= 0 && v <= 255);

/**
 * @param {any} b parsed JSON
 * @param {{name: string, keys: number, matrixKeys: number, limits: Record<string, [number, number]>, keymap: [number, string][]}} model
 * @returns {{keys: Record<number, ReturnType<typeof decodeKey>>, func: number[] | null, matrix: number[][] | null, colors: import('../codecs/colors.js').Rgb[] | null}}
 */
export function validateBackup(b, model) {
  if (!b || typeof b !== 'object') throw new Error('Not a backup file');
  if (b.device !== model.name) throw new Error(`Backup is for ${JSON.stringify(b.device)}, not ${model.name}`);
  if (!isBytes(b.keysHex, model.keys * 8)) throw new Error('Backup key data is malformed');
  /** @type {Record<number, ReturnType<typeof decodeKey>>} */
  const keys = {};
  for (const [row, name] of model.keymap) {
    const k = decodeKey(b.keysHex.slice(row * 8, row * 8 + 8));
    for (const [f, [lo, hi]] of Object.entries(model.limits)) {
      const v = /** @type {any} */ (k)[f];
      if (v < lo || v > hi) throw new Error(`Backup key ${name} (row ${row}): ${f} = ${v} is outside ${lo}-${hi}`);
    }
    keys[row] = k;
  }
  let func = null;
  if (b.funcHex !== undefined) {
    if (!isBytes(b.funcHex, 64)) throw new Error('Backup settings data is malformed');
    validateFunc(b.funcHex, b.funcHex[7] >> 5 & 7);
    func = b.funcHex;
  }
  /** @type {number[][] | null} */
  let matrix = null;
  if (b.matrixHex !== undefined) {
    if (!Array.isArray(b.matrixHex) || b.matrixHex.length !== 4 || !b.matrixHex.every((/** @type {unknown} */ l) => isBytes(l, model.matrixKeys * 3))) throw new Error('Backup remap data is malformed');
    matrix = b.matrixHex;
  }
  let colors = null;
  if (b.colorsHex !== undefined) {
    if (!isBytes(b.colorsHex, COLOR_AREA)) throw new Error('Backup colour data is malformed');
    colors = decodeColors(b.colorsHex, model.keys);
  }
  return { keys, func, matrix, colors };
}

/**
 * Keys whose values differ, for the preview shown before anything is applied.
 * @param {Record<number, any>} cur @param {Record<number, any>} next
 * @param {[number, string][]} keymap @param {string[]} fields
 */
export function diffKeys(cur, next, keymap, fields) {
  return keymap.flatMap(([row, name]) => {
    const changes = fields.filter(f => cur[row][f] !== next[row][f]).map(f => ({ field: f, from: cur[row][f], to: next[row][f] }));
    return changes.length ? [{ row, name, changes }] : [];
  });
}
