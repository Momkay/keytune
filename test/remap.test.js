import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ace75_8k } from '../src/models/ace75-8k.js';
import { createWriteGate } from '../src/safety/gate.js';
import { writeMatrixKey } from '../src/write.js';
import { exchange, CMD } from '../src/transport/device.js';
import { ALLOWED_COMMANDS } from '../src/transport/allowlist.js';
import { decodeMatrix, describeEntry, matrixOffset, isWritableEntry, remapChoices } from '../src/codecs/matrix.js';
import { validateBackup } from '../src/safety/backup.js';
import { mockKeyboard } from './helpers/mock-device.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/matrix-ace75-8k.json', import.meta.url), 'utf8'));
const gateOpen = () => { const g = createWriteGate(); g.markBackedUp(); return g; };
const Q = 9, R_ENTRY = { type: 16, code1: 0, code2: 21 }; // Q is matrix row 9 (PROTOCOL.md); HID usage 21 = R
const kb = () => { // mock keyboard whose matrix holds the real layer 0 / layer 1 bytes at offsets 0 / 512
  const matrix = new Array(512 * 8).fill(0);
  matrix.splice(0, 282, ...fx.L0); matrix.splice(512, 282, ...fx.L1);
  return mockKeyboard({ matrix });
};

test('cmd 9 is allowlisted (only 3-byte key writes go through writeMatrixKey)', () => {
  assert.ok(ALLOWED_COMMANDS.has(9));
});

test('matrixOffset: 512 per layer, 3 per key, profile 0', () => {
  assert.equal(matrixOffset(0, 0), 0);
  assert.equal(matrixOffset(1, 9), 512 + 27);
  assert.equal(matrixOffset(3, 31), 1536 + 93);
});

test('writable entries: plain keys, modifiers, media, unassigned; never special/unknown', () => {
  for (const e of [{ type: 16, code1: 0, code2: 4 }, { type: 16, code1: 1, code2: 0 }, { type: 48, code1: 226, code2: 0 }, { type: 0, code1: 0, code2: 0 }]) assert.ok(isWritableEntry(e), JSON.stringify(e));
  for (const e of [{ type: 240, code1: 255, code2: 1 }, { type: 48, code1: 7, code2: 0 }, { type: 16, code1: 0, code2: 232 }, { type: 16, code1: 256, code2: 4 }, { type: 99, code1: 0, code2: 0 }, { type: 16, code1: 0, code2: 1.5 }]) assert.ok(!isWritableEntry(e), JSON.stringify(e));
});

test('remap choices: every choice is writable and has a unique label', () => {
  const c = remapChoices();
  assert.ok(c.length > 90);
  assert.ok(c.every(x => isWritableEntry(x.entry)));
  assert.equal(new Set(c.map(x => x.label)).size, c.length);
  assert.ok(c.every(x => describeEntry(x.entry) === x.label));
});

test('write: changes only the one key, reads back, reports ok', async () => {
  const dev = kb();
  const r = await writeMatrixKey(dev, ace75_8k, gateOpen(), { layer: 1, key: Q, entry: R_ENTRY });
  assert.deepEqual(r.bad, []);
  const after = decodeMatrix(r.after, 94);
  assert.equal(describeEntry(after[Q]), 'R');
  const before = decodeMatrix(r.before, 94);
  assert.equal(describeEntry(before[Q]), 'Q');
  assert.deepEqual(after.filter((_, i) => i !== Q), before.filter((_, i) => i !== Q));
  const w = dev.sent.filter((/** @type {number[]} */ p) => p[1] === 9);
  assert.equal(w.length, 1);
  assert.deepEqual([w[0][4], w[0][5] | w[0][6] << 8], [3, 512 + 3 * Q]);
  assert.deepEqual(dev.sent.filter((/** @type {number[]} */ p) => p[1] === 9).length, 1);
});

test('write: a keyboard that ignores the write is reported as MISMATCH', async () => {
  const dev = mockKeyboard({ matrix: new Array(4096).fill(0).map((_, i) => fx.L1[i] ?? 0), dropWrites: true });
  const r = await writeMatrixKey(dev, ace75_8k, gateOpen(), { layer: 0, key: Q, entry: R_ENTRY });
  assert.ok(r.bad.length > 0);
});

test('write: refused without backup, unverified model, bad layer/key/entry (nothing sent)', async () => {
  const dev = kb();
  const ok = { layer: 1, key: Q, entry: R_ENTRY };
  await assert.rejects(writeMatrixKey(dev, ace75_8k, createWriteGate(), ok), /backup/);
  await assert.rejects(writeMatrixKey(dev, { ...ace75_8k, verified: false }, gateOpen(), ok), /read-only/);
  await assert.rejects(writeMatrixKey(dev, ace75_8k, gateOpen(), { ...ok, layer: 4 }), /layer/);
  await assert.rejects(writeMatrixKey(dev, ace75_8k, gateOpen(), { ...ok, layer: -1 }), /layer/);
  await assert.rejects(writeMatrixKey(dev, ace75_8k, gateOpen(), { ...ok, key: 3 }), /not a named key/); // row 3 is blank
  await assert.rejects(writeMatrixKey(dev, ace75_8k, gateOpen(), { ...ok, entry: { type: 240, code1: 255, code2: 1 } }), /not allowed/);
  assert.equal(dev.sent.length, 0);
});

test('the transport still only sends cmd 9 through exchange when allowlisted, with the right payload', async () => {
  const dev = kb();
  await exchange(dev, CMD.MATRIX_SET, 512 + 27, 3, [16, 0, 21]);
  assert.deepEqual(dev.sent[0].slice(0, 11), [0x55, 9, 0, dev.sent[0][3], 3, (512 + 27) & 255, (512 + 27) >> 8, 0, 16, 0, 21]);
});

test('backup: matrix layers are validated when present', () => {
  const layer = () => Array.from({ length: 384 }, (_, i) => fx.L0[i] ?? 0);
  const base = { device: 'Ace 75 8K', keysHex: new Array(1024).fill(0).map((_, i) => [0xa0, 0, 0x95, 0, 0x1d, 0x1e, 0x1d, 0x1e][i % 8]) };
  assert.equal(validateBackup({ ...base, matrixHex: [layer(), layer(), layer(), layer()] }, ace75_8k).matrix?.length, 4);
  assert.equal(validateBackup(base, ace75_8k).matrix, null);
  assert.throws(() => validateBackup({ ...base, matrixHex: [layer()] }, ace75_8k), /remap data is malformed/);
  assert.throws(() => validateBackup({ ...base, matrixHex: [layer(), layer(), layer(), [1, 2]] }, ace75_8k), /remap data is malformed/);
});
