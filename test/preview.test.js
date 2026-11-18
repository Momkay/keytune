import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreview } from '../src/ui/preview.js';
import { ace75_8k as model } from '../src/models/ace75-8k.js';

const OFF = { effect: 255, brightness: 0, speed: 1, dir: 0, ownColor: false, color: { r: 0, g: 0, b: 0 } };
const side = (/** @type {Record<string, any>} */ p) => ({ effect: 4, brightness: 100, speed: 1, ownColor: true, color: { r: 255, g: 255, b: 255 }, ...p });

/** Paint one frame with the given lights and return the light bar's gradient. @param {any} light @param {any} ambient */
function barFor(light, ambient) {
  /** @type {string[]} */
  const bar = [];
  const kb = { spots: () => [], setLit() {}, setLogo() {}, setBar: (/** @type {string} */ c) => bar.push(c) };
  createPreview({ kb, model, getState: () => ({ light, sides: { logo: side({ brightness: 0 }), ambient } }) }).refresh();
  return bar[0];
}

test('the light bar is the ambient light: it shows with the backlight off, and goes dark with ambient off', () => {
  assert.match(barFor(OFF, side({})), /rgb\(255, 255, 255\)/);
  assert.doesNotMatch(barFor(OFF, side({ brightness: 0 })), /rgb\((?!0, 0, 0)/);
});

test('with the ambient light on "follow backlight" the bar copies the backlight', () => {
  const wave = { effect: 6, brightness: 100, speed: 2, dir: 0, ownColor: false, color: { r: 0, g: 0, b: 0 } };
  assert.notEqual(barFor(wave, side({ effect: 0 })), barFor(OFF, side({ effect: 0 })));
});
