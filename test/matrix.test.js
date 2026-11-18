import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeMatrix } from '../src/codecs/matrix.js';

test('decodeMatrix splits 3-byte entries', () => {
  assert.deepEqual(decodeMatrix([16, 0, 52, 0, 0, 0, 16, 4, 20], 3), [
    { type: 16, code1: 0, code2: 52 }, { type: 0, code1: 0, code2: 0 }, { type: 16, code1: 4, code2: 20 },
  ]);
});

test('decodeMatrix rejects short data', () => {
  assert.throws(() => decodeMatrix([1, 2], 1), /too short/);
});

import { readFileSync } from 'node:fs';
import { describeEntry } from '../src/codecs/matrix.js';
import { ace75_8k } from '../src/models/ace75-8k.js';

// real bytes read with cmd 8 from the keyboard (profile 0); layer 0 = Win, layer 1 = Win + Fn
const fx = JSON.parse(readFileSync(new URL('./fixtures/matrix-ace75-8k.json', import.meta.url), 'utf8'));
const L0 = decodeMatrix(fx.L0, 94);
const L1 = decodeMatrix(fx.L1, 94);

test('layer 0: every named key row decodes to its own key name (cross-checks the key map and the decoder)', () => {
  const skip = new Set([22, 93]); // FN1 and RT are special entries, checked below
  for (const [row, name] of ace75_8k.keymap) {
    if (skip.has(row)) continue;
    assert.equal(describeEntry(L0[row]), name, `row ${row}`);
  }
  assert.equal(describeEntry(L0[22]), 'FN1');
  assert.deepEqual(L0[93], { type: 240, code1: 250, code2: 0 });
});

test('layer 1 (Fn): media keys on the F row, special functions elsewhere, everything else unchanged', () => {
  const byName = Object.fromEntries(ace75_8k.keymap.map(([row, name]) => [name, describeEntry(L1[row])]));
  assert.deepEqual(
    ['F1', 'F2', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].map(n => byName[n]),
    ['Bright-', 'Bright+', 'Prev', 'Play/Pause', 'Next', 'Mute', 'Vol-', 'Vol+'],
  );
  assert.deepEqual([byName.O, byName.P], ['Win mode', 'Mac mode']); // hub shows the Win and Mac logos there
  assert.equal(byName.Up, 'special 130/0'); // hub shows a lighting icon; exact function not decoded
  const changed = ace75_8k.keymap.filter(([row]) => describeEntry(L0[row]) !== describeEntry(L1[row]));
  assert.equal(changed.length, 22);
});

test('describeEntry: unassigned, unknown, modifier combos', () => {
  assert.equal(describeEntry({ type: 0, code1: 0, code2: 0 }), '');
  assert.equal(describeEntry({ type: 99, code1: 1, code2: 2 }), 'unknown 99/1/2');
  assert.equal(describeEntry({ type: 16, code1: 3, code2: 4 }), 'LCtrl+LShift+A');
  assert.equal(describeEntry({ type: 16, code1: 0, code2: 0x65 }), 'key 0x65');
  assert.equal(describeEntry({ type: 48, code1: 7, code2: 0 }), 'media 0x7');
});
