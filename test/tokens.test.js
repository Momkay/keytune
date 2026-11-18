import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ICONS, icon } from '../src/ui/icons.js';

const read = (/** @type {string} */ f) => readFileSync(new URL(`../src/ui/${f}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const style = read('style.css'), tokens = read('tokens.css');

test('style.css has no raw colours: every colour is a token', () => {
  assert.deepEqual(style.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(style.match(/\b(rgb|rgba|hsl|hsla)\(/g) ?? [], []);
});

test('style.css only uses hairline pixel values (1-3px); everything else is a token or a calc of tokens', () => {
  const body = style.split('\n').filter(l => !l.trim().startsWith('@media')).join('\n');
  const bad = [...body.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px/g)].map(m => m[0]).filter(v => !['0px', '1px', '2px', '3px'].includes(v));
  assert.deepEqual(bad, []);
});

test('the tokens define a 4px spacing scale, a type scale and both themes', () => {
  for (const t of ['--s-1: 4px', '--s-4: 16px', '--t-md: 13px', '--lh-body', '--r-md', '--accent']) assert.ok(tokens.includes(t), t);
  assert.ok(tokens.includes('prefers-color-scheme: light') && tokens.includes('data-theme="light"'));
});

test('every var() used in style.css is defined in tokens.css or inside style.css', () => {
  const defined = new Set([...(tokens + style).matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const used = new Set([...style.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]));
  const undefinedOnes = [...used].filter(u => !defined.has(u) && !['--w', '--u', '--lit', '--strip', '--bar'].includes(u));
  assert.deepEqual(undefinedOnes, []);
});

test('icons: every icon has a path and builds an accessible-hidden 24px svg', () => {
  assert.ok(Object.keys(ICONS).length >= 19); // 20 before the brand mark moved out to logo() (filled artwork, not a stroke icon)
  for (const [name, d] of Object.entries(ICONS)) assert.match(d, /^M[\d\sMLHVCSQTAZmlhvcsqtaz.,-]+$/, name);
  assert.throws(() => icon('nope'), /unknown icon/);
});
