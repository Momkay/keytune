// Remap tab: choose what a key sends, on each of the four layers.
import { h, fill } from './dom.js';
import { stageRemap } from './pending.js';
import { remapChoices, isWritableEntry, describeEntry } from '../codecs/matrix.js';
import { groupChoices, choiceName, ORDER } from './picker.js';
import { keyLabel } from './layout.js';

export const LAYER_NAMES = ['Windows', 'Win + Fn', 'Mac', 'Mac + Fn'];
/** The picker tab that was open last, kept while the panel is redrawn. */
let pickerTab = 'Letters';
const CHOICES = remapChoices();

/** Friendly keycap text for a matrix entry. @param {{type: number, code1: number, code2: number}} e */
export function capText(e) {
  if (e.type === 0) return '-';
  const d = describeEntry(e);
  return e.type === 240 && d.startsWith('special') ? 'Special' : keyLabel(d);
}

/** @param {import('./dom.js').Ctx} ctx */
export function remapPanel(ctx) {
  const { model } = ctx;
  const layerBar = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Layer' },
    LAYER_NAMES.map((n, i) => h('button', { type: 'button', 'aria-pressed': i === ctx.layer, class: i === ctx.layer ? 'seg on' : 'seg', onclick: () => ctx.setLayer(i) }, n)));
  const intro = h('p', { class: 'hint' }, 'A layer is a full set of key assignments. "Fn held" is what keys do while you hold the Fn key. Mac layers are used in Mac mode.');
  const row = [...ctx.sel][0];
  if (row === undefined) {
    return h('div', { class: 'sens' }, h('div', { class: 'panel-title' }, h('h2', {}, 'Remap keys')), layerBar, intro,
      h('div', { class: 'empty small' }, h('p', {}, 'Click the key you want to change.')));
  }
  const name = model.keymap.find((/** @type {[number, string]} */ [r]) => r === row)[1];
  const layer = ctx.matrix(ctx.layer);
  if (!layer) return h('div', { class: 'empty' }, h('p', {}, 'Reading this layer from the keyboard...'));
  const live = layer.live[row], factory = layer.factory[row];
  const staged = ctx.pending.remap.get(`${ctx.layer}:${row}`);
  const shown = staged ? (staged.to === 'factory' ? factory : staged.to) : live;
  const protectedKey = !isWritableEntry(live);
  const title = h('div', { class: 'panel-title' },
    h('h2', {}, `${name} sends ${capText(shown) === '-' ? 'nothing' : capText(shown)}`),
    !protectedKey && h('button', { type: 'button', class: 'btn ghost', disabled: !staged && describeEntry(live) === describeEntry(factory), onclick: () => { stageRemap(ctx.pending, ctx.layer, row, 'factory'); ctx.changed(); ctx.rebuildPanel(); } }, 'Reset to factory'));
  if (protectedKey) {
    return h('div', { class: 'sens' }, title, layerBar,
      h('p', { class: 'note' }, 'This key does something special (like Fn or switching between Windows and Mac mode), so it is locked to keep you from losing control of your keyboard.'));
  }
  const list = h('div', { class: 'picker' });
  const tabs = h('div', { class: 'segmented tight', role: 'group', 'aria-label': 'Kind of key' }, ORDER.map(g => h('button', { type: 'button', class: g === pickerTab ? 'seg on' : 'seg', 'aria-pressed': g === pickerTab, onclick: () => { pickerTab = g; ctx.rebuildPanel(); } }, g)));
  const render = (/** @type {string} */ q) => {
    const groups = groupChoices(CHOICES, q).filter(g => q.trim() || g.name === pickerTab);
    tabs.hidden = !!q.trim(); // a search looks through every kind of key
    fill(list, groups.length ? groups.map(g => h('div', { class: 'picks' }, g.items.map(c => h('button', {
      type: 'button', class: describeEntry(shown) === c.label ? 'pick on' : 'pick',
      onclick: () => { stageRemap(ctx.pending, ctx.layer, row, c.entry); ctx.changed(); ctx.rebuildPanel(); },
    }, choiceName(c.label))))) : h('p', { class: 'fine' }, 'Nothing matches that search.'));
  };
  render('');
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Search keys, like "vol" or "F5"', 'aria-label': 'Search keys', oninput: (/** @type {any} */ e) => render(e.target.value) });
  return h('div', { class: 'sens' }, title, layerBar, search, tabs, list);
}
