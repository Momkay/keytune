// Settings tab: things that apply to the whole keyboard.
import { h } from './dom.js';
import { slider, segmented, toggle } from './controls.js';
import { stageFunc } from './pending.js';
import { funcUiFromBlock } from '../codecs/func.js';

const DEBOUNCE_ON = 7; // what the official hub writes when its debounce switch is turned on (0 when off)
const RATES =/** @type {[string, string][]} */ ([['4', '1000 Hz'], ['3', '2000 Hz'], ['2', '4000 Hz'], ['1', '8000 Hz']]);

/** @param {import('./dom.js').Ctx} ctx */
export function settingsPanel(ctx) {
  const ui = ctx.pending.func ?? funcUiFromBlock(ctx.func);
  /** @param {Record<string, any>} patch @param {boolean} [rebuild] */
  const set = (patch, rebuild = false) => { stageFunc(ctx.pending, ctx.func, { ...(ctx.pending.func ?? funcUiFromBlock(ctx.func)), ...patch }); ctx.changed(); if (rebuild) ctx.rebuildPanel(); };

  const speed = h('section', { class: 'sec' }, h('h2', { class: 'card-title' }, 'Speed'),
    segmented({ label: 'Reporting speed', hint: 'How often the keyboard tells your computer about key presses. Higher means less delay.', options: RATES, value: RATES.some(([v]) => v === ui.rate) ? ui.rate : null, onChange: v => set({ rate: v }, true) }));

  const trigger = h('section', { class: 'sec' }, h('h2', { class: 'card-title' }, 'Rapid Trigger feel'),
    toggle({ label: 'Smooth out Rapid Trigger', hint: 'Filters tiny wobbles so a resting finger does not re-trigger the key.', checked: ui.rtOn, onChange: v => set({ rtOn: v }, true) }),
    ui.rtOn && slider({ label: 'Smoothing', hint: 'Lower reacts faster, higher is steadier.', min: 1, max: 15, step: 1, value: ui.rtv, format: v => String(v), onInput: v => set({ rtv: v }) }),
    toggle({ label: 'Stability mode', hint: 'Reduces noise in the key readings.', checked: ui.stab, onChange: v => set({ stab: v }) }),
    toggle({ label: 'Keep keys calibrated', hint: 'Adjusts automatically as switches settle in.', checked: ui.cal, onChange: v => set({ cal: v }) }));

  const typing = h('section', { class: 'sec' }, h('h2', { class: 'card-title' }, 'Typing'),
    toggle({ label: 'Ignore double presses', hint: 'Filters out accidental quick repeats of the same key.', checked: ui.deb >= 1, onChange: v => set({ deb: v ? DEBOUNCE_ON : 0 }) }),
    toggle({ label: 'Lock the Windows key', hint: 'Stops the Windows key from opening the Start menu while you play.', checked: ui.win, onChange: v => set({ win: v }) }));

  const sleep = h('section', { class: 'sec' }, h('h2', { class: 'card-title' }, 'Power'),
    toggle({ label: 'Never go to sleep', checked: ui.never, onChange: v => set({ never: v }, true) }),
    !ui.never && slider({ label: 'Sleep after', hint: 'The keyboard sleeps when you have not used it for this long.', min: 1, max: 30, step: 0.5, value: ui.sleepMin, format: v => `${v} min`, onInput: v => set({ sleepMin: v }) }));

  return h('div', { class: 'cards' }, speed, trigger, typing, sleep);
}
