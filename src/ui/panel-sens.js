// Sensitivity tab: how far a key travels before it counts, and Rapid Trigger.
import { h } from './dom.js';
import { slider, segmented } from './controls.js';
import { stageKeys, effectiveKey } from './pending.js';
import { toMm } from './units.js';
import { PRESETS } from './presets.js';

/** @param {import('./dom.js').Ctx} ctx */
export function sensPanel(ctx) {
  const { model, pending, cur } = ctx;
  const rows = [...ctx.sel];
  if (!rows.length) {
    return h('div', { class: 'empty' },
      h('h2', {}, 'Pick the keys you want to change'),
      h('p', {}, 'Click a key above. Hold Ctrl or Shift to pick several.'),
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.selectAll() }, 'Select all keys'));
  }
  const names = rows.map(r => model.keymap.find((/** @type {[number, string]} */ [row]) => row === r)[1]);
  const eff = rows.map(r => effectiveKey(pending, cur, r));
  /** @param {string} f */
  const mixed = f => new Set(eff.map(k => k[f])).size > 1;
  const first = eff[0];
  const set = (/** @type {Record<string, number>} */ patch) => { stageKeys(pending, cur, rows, patch); ctx.changed(); };
  const setAndRebuild = (/** @type {Record<string, number>} */ patch) => { set(patch); ctx.rebuildPanel(); };
  /** @param {string} field @param {string} label @param {string} hint */
  const dist = (field, label, hint) => slider({
    label, hint, min: model.limits[field][0] / 100, max: model.limits[field][1] / 100, step: 0.01,
    value: first[field] / 100, mixed: mixed(field), format: v => toMm(Math.round(v * 100)),
    onInput: v => set({ [field]: Math.round(v * 100) }),
  });
  const mode = mixed('keyMode') ? null : String(first.keyMode);

  return h('div', { class: 'sens' },
    h('div', { class: 'panel-title' },
      h('h2', {}, rows.length <= 3 ? `Editing ${names.join(', ')}` : `Editing ${rows.length} keys`),
      h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'btn ghost', onclick: () => ctx.selectAll() }, 'Select all'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => ctx.clearSelection() }, 'Clear'))),
    h('div', { class: 'presets', role: 'group', 'aria-label': 'Quick settings' },
      PRESETS.map(p => h('button', { type: 'button', class: 'chip', title: p.hint, onclick: () => setAndRebuild(p.patch) }, h('b', {}, p.name), h('small', {}, p.hint)))),
    h('div', { class: 'controls' },
      dist('actuation', 'Press point', 'How far you press before the key counts. Lower is more sensitive.'),
      segmented({
        label: 'Rapid Trigger', hint: 'Lets you tap the same key again as soon as you lift a little, without letting it all the way up.',
        options: [['0', 'Off'], ['1', 'On'], ['2', 'Continuous']], value: mode, onChange: v => setAndRebuild({ keyMode: Number(v) }),
      }),
      mode !== '0' && dist('rtPress', 'Press again after', 'Distance the key has to move down again to count as a new press.'),
      mode !== '0' && dist('rtRelease', 'Let go after', 'Distance the key has to rise to count as released.')),
    h('details', { class: 'more' },
      h('summary', {}, 'More options'),
      h('div', { class: 'controls' },
        dist('pressDeadzone', 'Ignore the top', 'A tiny area at the top where movement is ignored, to stop accidental presses.'),
        dist('releaseDeadzone', 'Ignore the bottom', 'A tiny area at the bottom where movement is ignored.'))));
}
