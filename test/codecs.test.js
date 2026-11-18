import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeKey, encodeKey } from '../src/codecs/key.js';
import { decodeFunc, encodeFunc, validateFunc, CHANGED } from '../src/codecs/func.js';

const SAMPLE = [0xa0, 0, 0x95, 0, 0x1d, 0x1e, 0x1d, 0x1e]; // real key row

test('key row: decode and round trip', () => {
  const k = decodeKey(SAMPLE);
  assert.equal(k.actuation, 150);
  assert.equal(k.rtPress, 30);
  assert.equal(k.pressDeadzone, 15);
  assert.deepEqual(encodeKey(k), SAMPLE);
});

test('key row: values above 255 use the high bit', () => {
  const k = { ...decodeKey(SAMPLE), actuation: 301, keyMode: 2 };
  const back = decodeKey(encodeKey(k));
  assert.equal(back.actuation, 301);
  assert.equal(back.keyMode, 2);
});

const block = () => { const b = new Array(64).fill(0); b[4] = 1; b[7] = 0x06; b[20] = 5; b[35] = 6; return b; };

test('settings: decode', () => {
  const d = decodeFunc(block());
  assert.equal(d.reportRate, 1);
  assert.equal(d.sleepTime, 6);
  assert.equal(d.rtsmart, 5);
});

test('settings: encode only touches the controlled bytes', () => {
  const cur = block();
  const next = encodeFunc(cur, { rate: '', win: true, deb: 1, cal: true, stab: true, rtOn: true, rtv: 6, sleepMin: 4, never: false });
  const changed = next.map((v, i) => v !== cur[i] ? i : -1).filter(i => i >= 0);
  assert.ok(changed.every(i => CHANGED.includes(i)));
  assert.equal(next[6] & 1, 1);
  assert.equal(next[7] >> 5, 1);
  assert.equal(next[20], 6);
  assert.equal(next[35], 8);
  assert.equal(encodeFunc(cur, { rate: '4', win: false, deb: 0, cal: true, stab: true, rtOn: false, rtv: 5, sleepMin: 3, never: true }).slice(4, 5)[0] & 15, 4);
});

test('settings: validation', () => {
  const ok = block(); ok[35] = 6;
  validateFunc(ok, 0);
  assert.throws(() => validateFunc(Object.assign(block(), { 20: 16 }), 0), /RT stability/);
  assert.throws(() => validateFunc(Object.assign(block(), { 35: 1 }), 0), /sleep/);
  assert.throws(() => validateFunc(block(), 9), /debounce/);
});
