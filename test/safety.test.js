import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ace75_8k } from '../src/models/ace75-8k.js';
import { models } from '../src/models/index.js';
import { createWriteGate } from '../src/safety/gate.js';
import { validateBackup, diffKeys } from '../src/safety/backup.js';
import { writeKeys, writeFunc } from '../src/write.js';
import { decodeKey, encodeKey } from '../src/codecs/key.js';
import { mockKeyboard } from './helpers/mock-device.js';

const ROW = [0xa0, 0, 0x95, 0, 0x1d, 0x1e, 0x1d, 0x1e]; // real key row: 150 / mode 0 / RT 30,30 / deadzone 15
const goodKeys = () => Array.from({ length: 128 }, () => ROW).flat();
const goodFunc = () => { const f = new Array(64).fill(0); f[20] = 5; f[35] = 6; return f; };
const backup = (over = {}) => ({ device: 'Ace 75 8K', keysHex: goodKeys(), funcHex: goodFunc(), ...over });
const gateOpen = () => { const g = createWriteGate(); g.markBackedUp(); return g; };

test('gate: needs a backup and a verified model', () => {
  const g = createWriteGate();
  assert.throws(() => g.assertCanWrite(ace75_8k), /backup/);
  assert.equal(g.backedUp, false);
  g.markBackedUp();
  g.assertCanWrite(ace75_8k);
  assert.throws(() => g.assertCanWrite({ name: 'X', verified: false }), /read-only/);
});

test('every unverified model is refused by the write functions', async () => {
  const unverified = [...models, { ...ace75_8k, name: 'Fake', verified: false }].filter(m => !m.verified);
  assert.ok(unverified.length > 0);
  for (const m of unverified) {
    const dev = mockKeyboard();
    await assert.rejects(writeKeys(dev, m, gateOpen(), new Map([[0, decodeKey(ROW)]])), /read-only/);
    await assert.rejects(writeFunc(dev, m, gateOpen(), goodFunc(), 0), /read-only/);
    assert.equal(dev.sent.length, 0);
  }
});

test('writes without a backup are refused before anything is sent', async () => {
  const dev = mockKeyboard();
  await assert.rejects(writeKeys(dev, ace75_8k, createWriteGate(), new Map([[0, decodeKey(ROW)]])), /backup/);
  await assert.rejects(writeFunc(dev, ace75_8k, createWriteGate(), goodFunc(), 0), /backup/);
  assert.equal(dev.sent.length, 0);
});

test('backup import: accepts a good file', () => {
  const r = validateBackup(backup(), ace75_8k);
  assert.equal(r.keys[31].actuation, 150);
  assert.equal(r.func?.length, 64);
  assert.equal(validateBackup(backup({ funcHex: undefined }), ace75_8k).func, null);
});

test('backup import: malformed, wrong model, out of range', () => {
  const bad = (/** @type {any} */ b, /** @type {RegExp} */ re) => assert.throws(() => validateBackup(b, ace75_8k), re);
  bad(null, /Not a backup/);
  bad(backup({ device: 'Ace 75 16K' }), /not Ace 75 8K/);
  bad(backup({ keysHex: [1, 2, 3] }), /malformed/);
  bad(backup({ keysHex: goodKeys().map((v, i) => i === 5 ? 300 : v) }), /malformed/);
  bad(backup({ keysHex: goodKeys().map((v, i) => i === 5 ? 'x' : v) }), /malformed/);
  const high = goodKeys(); high.splice(31 * 8, 8, ...encodeKey({ ...decodeKey(ROW), actuation: 450 }));
  bad(backup({ keysHex: high }), /Esc.*actuation = 450/);
  bad(backup({ funcHex: [1] }), /settings data is malformed/);
  bad(backup({ funcHex: Object.assign(goodFunc(), { 35: 200 }) }), /sleep/);
});

test('diff preview lists only changed keys', () => {
  const a = validateBackup(backup(), ace75_8k).keys;
  const b = structuredClone(a); b[31].actuation = 175;
  const f = Object.keys(ace75_8k.limits);
  assert.deepEqual(diffKeys(a, b, ace75_8k.keymap, f), [{ row: 31, name: 'Esc', changes: [{ field: 'actuation', from: 150, to: 175 }] }]);
  assert.deepEqual(diffKeys(a, a, ace75_8k.keymap, f), []);
});

test('write flow: writes, reads back, reports ok', async () => {
  const dev = mockKeyboard({ keys: goodKeys() });
  const r = await writeKeys(dev, ace75_8k, gateOpen(), new Map([[31, { ...decodeKey(ROW), actuation: 175 }]]));
  assert.deepEqual(r.bad, []);
  assert.equal(decodeKey(dev.keys.slice(31 * 8, 31 * 8 + 8)).actuation, 175);
});

test('write flow: out-of-range value rejects before the first write', async () => {
  const dev = mockKeyboard({ keys: goodKeys() });
  const want = new Map([[1, decodeKey(ROW)], [2, { ...decodeKey(ROW), actuation: 5000 }]]);
  await assert.rejects(writeKeys(dev, ace75_8k, gateOpen(), want), /key 2: actuation/);
  assert.equal(dev.sent.length, 0);
});

test('write flow: a write the keyboard ignores is reported as MISMATCH rows', async () => {
  const dev = mockKeyboard({ keys: goodKeys(), dropWrites: true });
  const r = await writeKeys(dev, ace75_8k, gateOpen(), new Map([[31, { ...decodeKey(ROW), actuation: 175 }]]));
  assert.deepEqual(r.bad, [31]);
});

test('settings write: cmd 6 at offsets 0 and 8, read-back compares', async () => {
  const dev = mockKeyboard({ func: goodFunc() });
  const next = goodFunc(); next[20] = 6; next[35] = 8;
  assert.deepEqual((await writeFunc(dev, ace75_8k, gateOpen(), next, 0)).bad, []);
  assert.deepEqual(dev.sent.filter((/** @type {number[]} */ p) => p[1] === 6).map((/** @type {number[]} */ p) => [p[5], p[6]]), [[0, 0], [8, 0]]);
  const ignored = mockKeyboard({ func: goodFunc(), dropWrites: true });
  assert.deepEqual((await writeFunc(ignored, ace75_8k, gateOpen(), next, 0)).bad, [20, 35]);
  await assert.rejects(writeFunc(dev, ace75_8k, gateOpen(), Object.assign(goodFunc(), { 20: 99 }), 0), /RT stability/);
});

test('CSP: strict meta tag, no inline script', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/);
});
