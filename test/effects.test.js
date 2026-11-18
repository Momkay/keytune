import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectColor, sideColor, hsv, hash, css } from '../src/ui/effects.js';
import { ace75_8k as model } from '../src/models/ace75-8k.js';

const base = { effect: 6, brightness: 100, speed: 4, dir: 0, ownColor: false, color: { r: 32, g: 96, b: 255 } };
const pos = { x: 0.3, y: 0.5, id: 7 };
const inRange = (/** @type {{r: number, g: number, b: number}} */ c) => [c.r, c.g, c.b].every(v => Number.isInteger(v) && v >= 0 && v <= 255);

test('every effect gives whole 0-255 colours over time and space, and is deterministic', () => {
  for (const fx of model.lightEffects) {
    for (const t of [0, 0.37, 1.9, 14.2]) for (const x of [0, 0.25, 0.6, 1]) for (const y of [0, 0.5, 1]) {
      const p = { x, y, id: Math.round(x * 90 + y * 5) };
      const c = effectColor(fx.id, p, t, { ...base, effect: fx.id }, [{ x: 0.4, y: 0.4, id: 20, t0: t - 0.3 }]);
      assert.ok(inRange(c), `${fx.name} ${t} ${x} ${y}`);
      assert.deepEqual(c, effectColor(fx.id, p, t, { ...base, effect: fx.id }, [{ x: 0.4, y: 0.4, id: 20, t0: t - 0.3 }]));
    }
  }
});

test('off and zero brightness are black; brightness scales the colour', () => {
  assert.deepEqual(effectColor(255, pos, 1, base), { r: 0, g: 0, b: 0 });
  assert.deepEqual(effectColor(6, pos, 1, { ...base, brightness: 0 }), { r: 0, g: 0, b: 0 });
  const full = effectColor(3, pos, 0, { ...base, effect: 3, ownColor: true });
  const half = effectColor(3, pos, 0, { ...base, effect: 3, ownColor: true, brightness: 50 });
  assert.deepEqual(full, { r: 32, g: 96, b: 255 });
  assert.ok(Math.abs(half.b - 128) <= 1);
});

test('steady uses the own colour when asked and white otherwise', () => {
  assert.deepEqual(effectColor(3, pos, 5, { ...base, effect: 3, ownColor: false }), { r: 255, g: 255, b: 255 });
  assert.deepEqual(effectColor(3, pos, 5, { ...base, effect: 3, ownColor: true }), base.color);
});

test('speed changes how far a wave has moved, direction reverses it', () => {
  const at = (/** @type {number} */ speed, /** @type {number} */ dir) => effectColor(6, pos, 2, { ...base, speed, dir });
  assert.notDeepEqual(at(1, 0), at(4, 0));
  assert.notDeepEqual(at(3, 0), at(3, 1));
  assert.deepEqual(effectColor(6, pos, 0, { ...base, dir: 0 }), effectColor(6, pos, 0, { ...base, dir: 1 })); // same at t = 0
});

test('breathing pulses and rainbow cycle changes with time', () => {
  const a = effectColor(4, pos, 0, { ...base, effect: 4 }), b = effectColor(4, pos, 1.3, { ...base, effect: 4 });
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(effectColor(1, pos, 0, { ...base, effect: 1 }), effectColor(1, pos, 3, { ...base, effect: 1 }));
});

test('typing effects glow near a fresh press and stay dim far away', () => {
  const press = [{ x: 0.5, y: 0.5, id: 40, t0: 10 }];
  for (const id of [13, 15, 16, 17]) {
    const near = effectColor(id, { x: 0.5, y: 0.5, id: 40 }, 10.2, { ...base, effect: id }, press);
    const far = effectColor(id, { x: 0.05, y: 0.95, id: 3 }, 10.2, { ...base, effect: id }, press);
    assert.ok(near.r + near.g + near.b > far.r + far.g + far.b, `effect ${id}`);
  }
});

test('side lights: follow copies the backlight, off is black, steady is the colour', () => {
  const logo = model.sideLights[0], ambient = model.sideLights[1];
  const main = { ...base, effect: 3, ownColor: true };
  const spot = { x: 1, y: 0.8, id: 66 };
  assert.deepEqual(sideColor(logo, { effect: 0, brightness: 100, speed: 4, ownColor: false, color: base.color }, main, spot, 1), effectColor(3, spot, 1, main));
  assert.deepEqual(sideColor(logo, { effect: 3, brightness: 0, speed: 4, ownColor: true, color: base.color }, main, spot, 1), { r: 0, g: 0, b: 0 });
  assert.deepEqual(sideColor(logo, { effect: 3, brightness: 100, speed: 4, ownColor: true, color: base.color }, main, spot, 1), base.color);
  assert.deepEqual(sideColor(ambient, { effect: 4, brightness: 100, speed: 4, ownColor: true, color: base.color }, main, spot, 1), base.color);
  const flow1 = sideColor(ambient, { effect: 1, brightness: 100, speed: 4, ownColor: false, color: base.color }, main, spot, 1, [], 0.2);
  const flow2 = sideColor(ambient, { effect: 1, brightness: 100, speed: 4, ownColor: false, color: base.color }, main, spot, 1, [], 0.7);
  assert.notDeepEqual(flow1, flow2); // flowing differs along the strip
});

test('helpers', () => {
  assert.deepEqual(hsv(0, 1, 1), { r: 255, g: 0, b: 0 });
  assert.ok(hash(1, 2) >= 0 && hash(1, 2) < 1 && hash(1, 2) === hash(1, 2));
  assert.equal(css({ r: 1, g: 2, b: 3 }), 'rgb(1, 2, 3)');
});
