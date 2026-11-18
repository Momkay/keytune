import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ace75_8k as model } from '../src/models/ace75-8k.js';
import { createSession } from '../src/session.js';
import { writeColors } from '../src/write.js';
import { emptyPending, stageKeys, stageRemap, stageFunc, stageColors } from '../src/ui/pending.js';
import { funcUiFromBlock } from '../src/codecs/func.js';
import { decodeKey } from '../src/codecs/key.js';
import { decodeMatrix, describeEntry } from '../src/codecs/matrix.js';
import { PRESETS } from '../src/ui/presets.js';
import { mockKeyboard } from './helpers/mock-device.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/matrix-ace75-8k.json', import.meta.url), 'utf8'));
const ROW = [0xa0, 0, 0x95, 0, 0x1d, 0x1e, 0x1d, 0x1e];
const Q = 9;

function setup(opts = {}) {
  const matrix = new Array(4096).fill(0);
  matrix.splice(0, 282, ...fx.L0); matrix.splice(512, 282, ...fx.L1);
  const func = new Array(64).fill(0); func[4] = 1; func[20] = 5; func[35] = 6;
  const kb = mockKeyboard({ keys: Array.from({ length: 128 }, () => ROW).flat(), func, matrix, ...opts });
  /** @type {string[]} */
  const files = [];
  const s = createSession(model, (name, text) => files.push(name + ':' + text.length));
  s.dev = kb;
  return { kb, s, files };
}

test('presets stay inside the model limits', () => {
  for (const p of PRESETS) for (const [f, v] of Object.entries(p.patch)) {
    const [lo, hi] = model.limits[f];
    assert.ok(v >= lo && v <= hi, `${p.name} ${f}`);
  }
});

test('load decodes the key table and settings block', async () => {
  const { s } = setup(); await s.load();
  assert.equal(s.cur.length, 128);
  assert.equal(s.cur[31].actuation, 150);
  assert.equal(s.func[20], 5);
});

test('apply: backs up first (once), writes keys + settings + remap, confirms by read-back, clears the staged changes', async () => {
  const { kb, s, files } = setup(); await s.load();
  stageKeys(s.pending, s.cur, [31, 9], { actuation: 100, keyMode: 1 });
  stageFunc(s.pending, s.func, { ...funcUiFromBlock(s.func), deb: 2 });
  stageRemap(s.pending, 1, Q, { type: 16, code1: 0, code2: 21 });
  /** @type {string[]} */
  const msgs = [];
  const r = await s.apply(m => msgs.push(m));
  assert.deepEqual(r.problems, []);
  assert.equal(files.length, 1);
  assert.match(files[0], /^keytune-backup-\d+\.json:/);
  assert.ok(msgs[0].includes('backup'));
  assert.equal(decodeKey(kb.keys.slice(31 * 8, 31 * 8 + 8)).actuation, 100);
  assert.equal(kb.func[7] >> 5, 2);
  assert.equal(describeEntry(decodeMatrix(kb.matrix.slice(512), 94)[Q]), 'R');
  assert.equal(s.pending.keys.size + s.pending.remap.size, 0);
  assert.equal(s.cur[31].actuation, 100); // reloaded from the keyboard
  await s.apply(); // nothing staged: no second backup
  assert.equal(files.length, 1);
});

test('apply: factory remap restores the original entry', async () => {
  const { kb, s } = setup(); await s.load();
  stageRemap(s.pending, 1, Q, { type: 16, code1: 0, code2: 21 }); await s.apply();
  stageRemap(s.pending, 1, Q, 'factory'); // factory read comes from cmd 7, which the mock serves from the same memory
  const live = await s.loadLayer(1);
  assert.equal(describeEntry(live.live[Q]), 'R');
  const r = await s.apply();
  assert.deepEqual(r.problems, []);
  assert.equal(kb.sent.filter((/** @type {number[]} */ p) => p[1] === 9).length, 2);
});

test('apply: a keyboard that ignores writes is reported as problems', async () => {
  const { s } = setup({ dropWrites: true }); await s.load();
  stageKeys(s.pending, s.cur, [31], { actuation: 100 });
  stageFunc(s.pending, s.func, { ...funcUiFromBlock(s.func), deb: 2 });
  stageRemap(s.pending, 0, Q, { type: 16, code1: 0, code2: 21 });
  const { problems } = await s.apply();
  assert.equal(problems.length, 3);
});

test('apply refuses on an unverified model', async () => {
  const { s } = setup(); s.model.verified = false;
  try {
    await s.load(); stageKeys(s.pending, s.cur, [31], { actuation: 100 });
    await assert.rejects(s.apply(), /read-only/);
  } finally { s.model.verified = true; }
});

test('stageBackup: stages differing keys, settings and writable remaps; skips special entries', async () => {
  const { s } = setup(); await s.load();
  const keys = Array.from({ length: 128 }, () => ROW).flat();
  keys.splice(31 * 8 + 2, 1, 0x64); // Esc actuation 101
  const matrix = [0, 1, 2, 3].map(l => { const m = new Array(384).fill(0); if (l < 2) m.splice(0, 282, ...(l === 1 ? fx.L1 : fx.L0)); return m; }); // same as the mock keyboard: layers 2 and 3 are empty there
  matrix[0].splice(3 * Q, 3, 16, 0, 21); // Q -> R on layer 0 (writable)
  matrix[0].splice(3 * 31, 3, 240, 9, 9); // Esc -> special (not writable)
  const func = new Array(64).fill(0); func[4] = 1; func[20] = 6; func[35] = 6;
  const r = await s.stageBackup({ device: 'Ace 75 8K', keysHex: keys, funcHex: func, matrixHex: matrix });
  assert.deepEqual(r, { keys: 1, remap: 1, settings: 1, colors: 0, skipped: 1 });
  assert.equal(s.pending.keys.get(31)?.actuation, 101);
  await assert.rejects(s.stageBackup({ device: 'Ace 75 16K' }), /not Ace 75 8K/);
});

test('apply: a lighting change is written, confirmed and cleared', async () => {
  const { kb, s } = setup(); await s.load();
  const ui = funcUiFromBlock(s.func);
  stageFunc(s.pending, s.func, { ...ui, light: { effect: 4, brightness: 40, speed: 2, dir: 1, ownColor: true, color: { r: 9, g: 8, b: 7 } } });
  const { problems } = await s.apply();
  assert.deepEqual(problems, []);
  assert.deepEqual(kb.func.slice(8, 17), [4, 40, 2, 1, 0, 0, 9, 8, 7]);
  assert.equal(s.pending.func, null);
});

test('apply: logo and ambient light changes are written and confirmed', async () => {
  const { kb, s } = setup(); await s.load();
  const ui = funcUiFromBlock(s.func);
  stageFunc(s.pending, s.func, { ...ui, sides: {
    logo: { effect: 2, brightness: 60, speed: 3, ownColor: true, color: { r: 1, g: 2, b: 3 } },
    ambient: { effect: 4, brightness: 0, speed: 4, ownColor: false, color: { r: 0, g: 0, b: 0 } },
  } });
  const { problems } = await s.apply();
  assert.deepEqual(problems, []);
  assert.deepEqual(kb.func.slice(44, 52), [2, 60, 1, 0, 0, 1, 2, 3]);
  assert.deepEqual(kb.func.slice(24, 32).slice(0, 4), [4, 0, 0, 1]);
});

test('profiles: another profile is read at its own offsets, is view-only, and switching needs no pending changes', async () => {
  const other = [0xa0, 0, 0xc8, 0, 0x1d, 0x1e, 0x1d, 0x1e];
  const { s } = setup({ keys: [...Array.from({ length: 128 }, () => ROW).flat(), ...Array.from({ length: 128 }, () => other).flat()] });
  await s.load();
  assert.equal(s.active, 1); // mock base block: byte 0 = 1
  stageKeys(s.pending, s.cur, [31], { actuation: 100 });
  await assert.rejects(s.showProfile(1), /Apply or discard/);
  s.pending = emptyPending();
  await s.showProfile(1);
  assert.equal(s.cur[31].actuation, 201); // raw 0xc8 decodes with the same +1 as 0x95 -> 150
  await assert.rejects(s.showProfile(3), /profile must be/);
  stageKeys(s.pending, s.cur, [31], { actuation: 100 });
  await assert.rejects(s.apply(), /view-only/);
  s.pending = emptyPending();
  await s.showProfile(0);
  assert.equal(s.cur[31].actuation, 150);
});

test('activate: backs up first, changes only byte 0 of the base block, reads it back; refuses staged changes', async () => {
  const { kb, s, files } = setup({ keys: new Array(3072).fill(0) });
  await s.load();
  await s.showProfile(2);
  stageKeys(s.pending, s.cur, [31], { actuation: 100 });
  await assert.rejects(s.activate(), /Apply or discard/);
  s.pending = emptyPending();
  const r = await s.activate();
  assert.deepEqual(r.problems, []);
  assert.equal(files.length, 1);
  const base = kb.sent.filter((/** @type {number[]} */ p) => p[1] === 14);
  assert.equal(base.length, 1);
  assert.deepEqual(base[0].slice(8, 13), [2, 3, 0, 1, 2]); // active 2, rest of the block unchanged
  assert.equal(s.active, 2);
});

test('colours: apply writes painted keys (cmd 11), reads the table back, and the backup carries it', async () => {
  const { kb, s, files } = setup(); await s.load();
  assert.deepEqual(s.colors[31], { r: 0, g: 0, b: 0 });
  stageColors(s.pending, s.colors, [31, 9], { r: 255, g: 0, b: 128 });
  stageColors(s.pending, s.colors, [10], { r: 0, g: 0, b: 0 }); // same as stored: not staged
  assert.equal(s.pending.colors.size, 2);
  const r = await s.apply();
  assert.deepEqual(r.problems, []);
  assert.deepEqual(kb.colors.slice(93, 96), [255, 0, 128]);
  assert.deepEqual(kb.colors.slice(27, 30), [255, 0, 128]);
  assert.deepEqual(s.colors[31], { r: 255, g: 0, b: 128 });
  assert.equal(s.pending.colors.size, 0);
  const sent = kb.sent.filter((/** @type {number[]} */ p) => p[1] === 11);
  assert.equal(sent.length, 2); // one 3-byte write per painted key, nothing else
  const snap = await s.backup();
  assert.equal(snap.colorsHex.length, 512);
  assert.equal(files.length, 2);
});

test('colours: out-of-range or unnamed-key writes are refused before anything is sent; stageBackup stages colours', async () => {
  const { kb, s } = setup(); await s.load(); await s.backup();
  const gate = s.gate;
  await assert.rejects(writeColors(kb, model, gate, new Map([[31, { r: 256, g: 0, b: 0 }]])), /0-255/);
  await assert.rejects(writeColors(kb, model, gate, new Map([[127, { r: 1, g: 1, b: 1 }]])), /not a named key/);
  assert.equal(kb.sent.filter((/** @type {number[]} */ p) => p[1] === 11).length, 0);
  const colorsHex = new Array(512).fill(0); colorsHex.splice(93, 3, 9, 8, 7);
  const r = await s.stageBackup({ device: 'Ace 75 8K', keysHex: Array.from({ length: 128 }, () => ROW).flat(), colorsHex });
  assert.equal(r.colors, 1);
  assert.deepEqual(s.pending.colors.get(31), { r: 9, g: 8, b: 7 });
  await assert.rejects(s.stageBackup({ device: 'Ace 75 8K', keysHex: Array.from({ length: 128 }, () => ROW).flat(), colorsHex: [1, 2] }), /colour data/);
});
