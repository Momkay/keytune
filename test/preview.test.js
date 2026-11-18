import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perimeterPoint, conic } from '../src/ui/preview.js';

test('strip samples walk once around the case, clockwise from the top left', () => {
  const pts = Array.from({ length: 8 }, (_, i) => perimeterPoint(i, 8));
  assert.deepEqual(pts[0], { x: 0, y: 0 });
  assert.deepEqual(pts[2], { x: 1, y: 0 });
  assert.deepEqual(pts[4], { x: 1, y: 1 });
  assert.deepEqual(pts[6], { x: 0, y: 1 });
  assert.ok(pts.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
});

test('conic gradient closes the loop with the first colour', () => {
  const g = conic(['red', 'green', 'blue']);
  assert.equal(g, 'conic-gradient(from 0deg, red 0%, green 33%, blue 67%, red 100%)');
});
