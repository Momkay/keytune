import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPending, stageKeys, effectiveKey, stageRemap, stageFunc, changeCounts, isEmpty, summary } from '../src/ui/pending.js';
import { toMm, fromMm } from '../src/ui/units.js';
import { groupChoices, groupOf, choiceName } from '../src/ui/picker.js';
import { remapChoices } from '../src/codecs/matrix.js';
import { encodeFunc, funcUiFromBlock } from '../src/codecs/func.js';

const cur = { 5: { actuation: 150, keyMode: 0, rtPress: 30 }, 6: { actuation: 150, keyMode: 0, rtPress: 30 } };

test('staging a key change, merging, and dropping it when it equals the live value', () => {
  const p = emptyPending();
  stageKeys(p, cur, [5, 6], { actuation: 100 });
  assert.deepEqual(changeCounts(p), { keys: 2, remap: 0, settings: 0, colors: 0 });
  stageKeys(p, cur, [5], { keyMode: 1 });
  assert.deepEqual(effectiveKey(p, cur, 5), { actuation: 100, keyMode: 1, rtPress: 30 });
  stageKeys(p, cur, [5, 6], { actuation: 150 }); // back to the live value
  assert.deepEqual([...p.keys.keys()], [5]);
  stageKeys(p, cur, [5], { keyMode: 0 });
  assert.ok(isEmpty(p));
});

test('remap staging and summary text', () => {
  const p = emptyPending();
  stageRemap(p, 1, 9, { type: 16, code1: 0, code2: 21 });
  stageRemap(p, 1, 9, 'factory'); // replaces
  stageRemap(p, 0, 4, 'factory');
  stageKeys(p, cur, [5], { actuation: 90 });
  assert.equal(p.remap.size, 2);
  assert.equal(summary(p), '1 key with new sensitivity · 2 remapped keys');
  stageRemap(p, 1, 9, null);
  assert.equal(p.remap.size, 1);
  assert.equal(summary(emptyPending()), '');
});

test('settings staging only when something really changes', () => {
  const block = new Array(64).fill(0); block[4] = 1; block[20] = 5; block[35] = 6;
  const p = emptyPending();
  const ui = funcUiFromBlock(block);
  stageFunc(p, block, ui);
  assert.equal(p.func, null);
  stageFunc(p, block, { ...ui, deb: 2 });
  assert.equal(changeCounts(p).settings, 1);
  assert.match(summary(p), /settings and lighting/);
  assert.deepEqual(encodeFunc(block, funcUiFromBlock(block)), block); // funcUiFromBlock is the inverse of encodeFunc
});

test('millimetres <-> raw units', () => {
  assert.equal(toMm(150), '1.50 mm');
  assert.equal(fromMm(1.5, [10, 400]), 150);
  assert.equal(fromMm(0.01, [10, 400]), 10);
  assert.equal(fromMm(9, [10, 400]), 400);
});

test('picker groups every choice once and filters by name', () => {
  const choices = remapChoices();
  const all = groupChoices(choices);
  assert.equal(all.reduce((n, g) => n + g.items.length, 0), choices.length);
  assert.deepEqual(all.map(g => g.name), ['Letters', 'Numbers', 'F keys', 'Modifiers', 'Media', 'Other']);
  assert.deepEqual(groupChoices(choices, 'vol').flatMap(g => g.items.map(i => i.label)), ['Vol+', 'Vol-']);
  assert.deepEqual(groupChoices(choices, 'zzz'), []);
  assert.equal(choiceName(''), 'None (disables the key)');
  assert.equal(groupOf({ label: '', entry: { type: 0, code1: 0, code2: 0 } }), 'Other');
});
