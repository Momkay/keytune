import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ace75_8k as m } from '../src/models/ace75-8k.js';
import { layoutRows } from '../src/ui/layout.js';

test('every row is 16 units wide', () => {
  for (const row of layoutRows(m)) assert.equal(Math.round(row.reduce((w, k) => w + k.w, 0) * 100) / 100, 16);
});

test('every named key appears exactly once (board + extras), with its matrix row', () => {
  const placed = layoutRows(m).flat().filter(k => k.name).map(k => k.name).concat(m.extras);
  const named = m.keymap.map(([, n]) => n);
  assert.deepEqual([...placed].sort(), [...named].sort());
  for (const k of layoutRows(m).flat().filter(k => k.name)) assert.equal(m.keymap.find(([, n]) => n === k.name)?.[0], k.row);
});

test('gaps carry no row, keys carry a width and a friendly label', () => {
  const flat = layoutRows(m).flat();
  assert.ok(flat.some(k => !k.name && k.row === undefined));
  assert.equal(flat.find(k => k.name === 'Bksp')?.label, 'Backspace');
  assert.equal(flat.find(k => k.name === 'Up')?.label, '↑');
  assert.equal(flat.find(k => k.name === 'Space')?.w, 6.25);
});

import { spokenName } from '../src/ui/layout.js';

test('spoken names are clear for keys whose caps are symbols or abbreviations', () => {
  assert.equal(spokenName('LShift'), 'Left Shift');
  assert.equal(spokenName('\\'), 'Backslash');
  assert.equal(spokenName('Up'), 'Up arrow');
  assert.equal(spokenName('W'), 'W');
  for (const [, name] of m.keymap) assert.ok(spokenName(name).length > 0);
});

test('the logo key sits at the end of the shift row and every item has a centre inside the board', () => {
  const rows = layoutRows(m);
  const logo = rows.flat().filter(k => k.kind === 'logo');
  assert.equal(logo.length, 1);
  assert.equal(rows[4].at(-1)?.kind, 'logo');
  assert.ok(rows.flat().every(k => k.cx > 0 && k.cx < 1 && k.cy > 0 && k.cy < 1));
  assert.ok(logo[0].cx > 0.9);
});
