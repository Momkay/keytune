import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ace75_8k as model } from '../src/models/ace75-8k.js';
import { encodeFunc, funcUiFromBlock, validateFunc, CHANGED } from '../src/codecs/func.js';
import { rgbToHex, hexToRgb } from '../src/ui/color.js';

// real settings block read from the keyboard on 2026-11-18: horizontal wave (6), brightness 100, speed 4, left to right, effect colours
const REAL = '80,0,170,187,1,1,0,6,6,100,0,0,1,0,255,0,0,0,0,0,5,1,0,0,0,100,0,1,1,255,0,0,0,0,0,6,0,0,0,0,255,255,255,0,0,100,0,1,1,255,0,0,16,16,16,16,16,16,16,16,16,16,16,16'.split(',').map(Number);

test('real block decodes to what the hub showed (horizontal wave, speed 4, 100%, left to right)', () => {
  const { light } = funcUiFromBlock(REAL);
  assert.deepEqual(light, { effect: 6, brightness: 100, speed: 4, dir: 0, ownColor: false, color: { r: 255, g: 0, b: 0 } });
  assert.equal(model.lightEffects.find(e => e.id === light.effect)?.name, 'Horizontal wave');
});

test('light encode is the inverse of decode, and only touches the light bytes', () => {
  assert.deepEqual(encodeFunc(REAL, funcUiFromBlock(REAL)), REAL);
  const ui = funcUiFromBlock(REAL);
  const next = encodeFunc(REAL, { ...ui, light: { effect: 4, brightness: 50, speed: 2, dir: 1, ownColor: true, color: { r: 1, g: 2, b: 3 } } });
  assert.deepEqual(next.slice(8, 17), [4, 50, 2, 1, 0, 0, 1, 2, 3]);
  const changed = next.flatMap((v, i) => (v !== REAL[i] ? [i] : []));
  assert.deepEqual(changed.filter(i => !CHANGED.includes(i)), []);
});

test('light validation', () => {
  validateFunc(REAL, 0);
  /** @param {number} i @param {number} v @param {RegExp} re */
  const bad = (i, v, re) => assert.throws(() => validateFunc(Object.assign(REAL.slice(), { [i]: v }), 0), re);
  bad(9, 101, /brightness/);
  bad(10, 4, /speed/);
  bad(11, 2, /direction/);
  bad(12, 2, /own-colour/);
});

test('effect table: unique ids, the current effect and Off exist, sensible capabilities', () => {
  const ids = model.lightEffects.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(255) && ids.includes(6));
  assert.equal(ids.length, 24); // 22 effects + Off + Custom colors (id 0, the stored per-key table, verified in S1)
  for (const e of model.lightEffects) assert.ok(e.id >= 0 && e.id <= 255 && e.name);
  assert.equal(model.lightEffects.find(e => e.id === 255)?.color, false);
});

test('colour helpers', () => {
  assert.equal(rgbToHex({ r: 255, g: 0, b: 16 }), '#ff0010');
  assert.deepEqual(hexToRgb('#0a0B0c'), { r: 10, g: 11, b: 12 });
  assert.throws(() => hexToRgb('red'), /rrggbb/);
});

import { SIDE_BASE, decodeSide } from '../src/codecs/func.js';

// real blocks read while the hub's lighting options were clicked one at a time (2026-11-18)
const withBytes = (/** @type {number} */ at, /** @type {number[]} */ bytes) => { const b = REAL.slice(); b.splice(at, bytes.length, ...bytes); return b; };

test('logo light = bytes 44-51: follow 0, rainbow 1, breathing 2, steady 3 (what the hub wrote)', () => {
  assert.deepEqual(SIDE_BASE, { logo: 44, ambient: 24 });
  for (const [value, name] of /** @type {[number, string][]} */ ([[0, 'follow'], [1, 'rainbow'], [2, 'breathing'], [3, 'steady']])) {
    const s = decodeSide(withBytes(44, [value, 100, 0, 1, 1, 255, 0, 0]), 44);
    assert.equal(s.effect, value, name);
    assert.deepEqual([s.brightness, s.speed, s.ownColor], [100, 4, false]);
  }
  assert.equal(model.sideLights[0].effects.map(e => e.value).join(), '1,2,3');
});

test('ambient light = bytes 24-31: follow 0, flowing 1, rainbow 2, breathing 3, steady 4', () => {
  assert.equal(decodeSide(withBytes(24, [4, 100, 0, 1, 1, 255, 0, 0]), 24).effect, 4);
  assert.equal(model.sideLights[1].effects.map(e => e.value).join(), '1,2,3,4');
});

test('"Off" is the steady effect with brightness 0, and the hub master switch zeroes all three brightness bytes', () => {
  assert.equal(decodeSide(withBytes(44, [3, 0, 0, 1, 1, 255, 0, 0]), 44).brightness, 0);
  const masterOff = '80,0,170,187,1,1,0,6,6,0,0,0,1,0,255,0,0,0,0,0,5,1,0,0,0,0,0,1,1,255,0,0,0,0,0,6,0,0,0,0,255,255,255,0,0,0,0,1,1,255,0,0,16,16,16,16,16,16,16,16,16,16,16,16'.split(',').map(Number);
  const ui = funcUiFromBlock(masterOff);
  assert.deepEqual([ui.light.brightness, ui.sides.logo.brightness, ui.sides.ambient.brightness], [0, 0, 0]);
  assert.equal(ui.light.effect, 6); // effects are left alone
  assert.deepEqual(encodeFunc(masterOff, ui), masterOff);
});

test('side light encode touches only its own bytes and round-trips', () => {
  const ui = funcUiFromBlock(REAL);
  assert.deepEqual(encodeFunc(REAL, ui), REAL);
  const next = encodeFunc(REAL, { ...ui, sides: { ...ui.sides, logo: { effect: 2, brightness: 40, speed: 3, ownColor: true, color: { r: 9, g: 8, b: 7 } } } });
  assert.deepEqual(next.slice(44, 52), [2, 40, 1, 0, 1, 9, 8, 7]);
  assert.deepEqual(next.slice(0, 44), REAL.slice(0, 44));
  assert.deepEqual(next.slice(52), REAL.slice(52));
});

test('side light validation', () => {
  const bad = (/** @type {number} */ i, /** @type {number} */ v, /** @type {RegExp} */ re) => assert.throws(() => validateFunc(Object.assign(REAL.slice(), { [i]: v }), 0), re);
  bad(25, 101, /brightness/); bad(45, 101, /brightness/); bad(26, 4, /speed/); bad(46, 4, /speed/); bad(24, 7, /effect/); bad(47, 2, /own-colour/);
});
