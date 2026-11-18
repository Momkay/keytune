// Lighting tab: the main backlight, the logo light and the ambient light, plus an "all lights" switch.
import { h } from './dom.js';
import { slider, segmented, toggle } from './controls.js';
import { stageFunc } from './pending.js';
import { funcUiFromBlock } from '../codecs/func.js';
import { rgbToHex, hexToRgb } from './color.js';


const GROUPS = ['Custom', 'Motion', 'Colors', 'Sparkle', 'Reacts to typing', 'Off'];

/** @param {import('./dom.js').Ctx} ctx */
export function lightPanel(ctx) {
  const ui = ctx.pending.func ?? funcUiFromBlock(ctx.func);
  /** Change a copy of the staged values; `fn` mutates it. @param {(u: any) => void} fn @param {boolean} [rebuild] */
  const edit = (fn, rebuild = false) => {
    const next = structuredClone(ctx.pending.func ?? funcUiFromBlock(ctx.func));
    fn(next);
    stageFunc(ctx.pending, ctx.func, next);
    ctx.changed();
    if (rebuild) ctx.rebuildPanel();
  };
  const group = ctx.lightGroup ?? 'main';

  const anyOn = ui.light.brightness > 0 || ui.sides.logo.brightness > 0 || ui.sides.ambient.brightness > 0;
  const master = toggle({
    label: 'All lights', hint: 'Switches every light on or off at once. Your effects are kept.', checked: anyOn,
    onChange: v => {
      if (!v) ctx.lastBrightness = { main: ui.light.brightness || ctx.lastBrightness?.main, logo: ui.sides.logo.brightness || ctx.lastBrightness?.logo, ambient: ui.sides.ambient.brightness || ctx.lastBrightness?.ambient };
      const was = ctx.lastBrightness ?? {};
      edit(u => { u.light.brightness = v ? was.main || 100 : 0; u.sides.logo.brightness = v ? was.logo || 100 : 0; u.sides.ambient.brightness = v ? was.ambient || 100 : 0; }, true);
    },
  });
  const chooser = segmented({
    label: 'Which light', options: [['main', 'Backlight'], ['logo', 'Logo'], ['ambient', 'Ambient']], value: group,
    onChange: v => { ctx.lightGroup = v; ctx.rebuildPanel(); },
  });
  const top = h('section', { class: 'sec' }, h('div', { class: 'light-top' }, chooser, master));

  const body = group === 'main' ? mainCards(ctx, ui, edit) : sideCards(ctx, ui, edit, group);
  return h('div', { class: 'cards light' }, top, ...body);
}

/** @param {import('./dom.js').Ctx} ctx @param {any} ui @param {(fn: (u: any) => void, rebuild?: boolean) => void} edit */
function mainCards(ctx, ui, edit) {
  const light = ui.light;
  const fx = ctx.model.lightEffects.find((/** @type {{id: number}} */ e) => e.id === light.effect);
  /** @param {Record<string, any>} patch @param {boolean} [rebuild] */
  const set = (patch, rebuild = false) => edit(u => Object.assign(u.light, patch), rebuild);

  const ordered = GROUPS.flatMap(g => ctx.model.lightEffects.filter((/** @type {{group: string}} */ e) => e.group === g));
  const effects = h('section', { class: 'sec' }, h('h2', { class: 'card-title' }, 'Effect'),
    h('div', { class: 'fx-grid' }, ordered.map((/** @type {{id: number, name: string, short?: string}} */ e) => h('button', {
      type: 'button', class: e.id === light.effect ? 'pick on' : 'pick', 'aria-pressed': e.id === light.effect, title: e.name, onclick: () => set({ effect: e.id }, true),
    }, e.short ?? e.name))));

  const look = h('section', { class: 'sec', 'aria-label': fx ? fx.name : 'Effect' },
    !fx && h('p', { class: 'hint' }, 'This keyboard is using a lighting effect this app does not know yet. Pick one on the left to replace it.'),
    fx?.id !== 255 && slider({ label: 'Brightness', min: 0, max: 100, step: 1, value: light.brightness, format: v => `${v}%`, onInput: v => set({ brightness: v }) }),
    (fx?.speed || fx?.dir) && h('div', { class: 'pair' },
      fx?.speed && segmented({
        label: 'Speed', hint: 'Level 1 to 4. Use 4 for the fastest animation the keyboard offers.',
        options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], value: String(light.speed), onChange: v => set({ speed: Number(v) }, true),
      }),
      fx?.dir && segmented({
        label: 'Direction', options: fx.id === 6 ? [['0', 'Left to right'], ['1', 'Right to left']] : [['0', 'Forward'], ['1', 'Reverse']],
        value: String(light.dir), onChange: v => set({ dir: Number(v) }, true),
      })),
    ...(fx?.id === 0 ? paintControls(ctx) : colorControls(fx, light, (/** @type {Record<string, any>} */ p, /** @type {boolean} */ r) => set(p, r), 'lightcolor')));
  return [effects, look];
}

/** @param {import('./dom.js').Ctx} ctx @param {any} ui @param {(fn: (u: any) => void, rebuild?: boolean) => void} edit @param {string} key */
function sideCards(ctx, ui, edit, key) {
  const spec = ctx.model.sideLights.find((/** @type {{key: string}} */ s) => s.key === key);
  const s = ui.sides[key];
  const isFollow = s.effect === spec.follow;
  const isOff = !isFollow && s.effect === spec.off && s.brightness === 0;
  const cur = isFollow || isOff ? undefined : spec.effects.find((/** @type {{value: number}} */ e) => e.value === s.effect);
  /** @param {string} label @param {boolean} on @param {() => void} fn */
  const pick = (label, on, fn) => h('button', { type: 'button', class: on ? 'pick on' : 'pick', 'aria-pressed': on, onclick: fn }, label);
  const set = (/** @type {Record<string, any>} */ patch, /** @type {boolean} */ rebuild = false) => edit(u => Object.assign(u.sides[key], patch), rebuild);

  const effects = h('section', { class: 'sec' }, h('h2', { class: 'card-title' }, spec.name),
    h('div', { class: 'fx-grid' },
      pick('Follow backlight', isFollow, () => set({ effect: spec.follow }, true)),
      spec.effects.map((/** @type {{value: number, name: string}} */ e) => pick(e.name, cur?.value === e.value, () => edit(u => { const t = u.sides[key]; t.effect = e.value; if (t.brightness === 0) t.brightness = 100; }, true))),
      pick('Off', isOff, () => edit(u => { const t = u.sides[key]; t.effect = spec.off; t.brightness = 0; }, true))));

  const look = h('section', { class: 'sec' }, h('h2', { class: 'card-title' }, 'Look'),
    isFollow && h('p', { class: 'hint' }, 'This light copies the backlight, so there is nothing to set here.'),
    isOff && h('p', { class: 'hint' }, 'This light is off. Pick an effect to turn it on.'),
    cur && slider({ label: 'Brightness', min: 0, max: 100, step: 1, value: s.brightness, format: v => `${v}%`, onInput: v => set({ brightness: v }) }),
    cur?.speed && segmented({ label: 'Speed', hint: 'Level 1 to 4.', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], value: String(s.speed), onChange: v => set({ speed: Number(v) }, true) }),
    ...(cur ? colorControls(cur, s, (/** @type {Record<string, any>} */ p, /** @type {boolean} */ r) => set(p, r), 'sidecolor-' + key) : []));
  return [effects, look];
}

/** "Use my own color" switch with the colour picker on the same row, for an effect that can use one. */
function colorControls(/** @type {any} */ fx, /** @type {any} */ state, /** @type {(p: Record<string, any>, rebuild: boolean) => void} */ set, /** @type {string} */ id) {
  if (!fx) return [];
  if (!fx.color) return fx.id === 255 ? [] : [h('p', { class: 'fine' }, 'This effect has its own colors.')];
  return [h('div', { class: 'control toggle-row', title: 'Off uses the built-in colors of the effect.' },
    h('label', { for: id + '-sw' }, 'Use my own color'),
    h('div', { class: 'inline' },
      state.ownColor && h('input', { id, type: 'color', class: 'colorpick', 'aria-label': 'Color', value: rgbToHex(state.color), oninput: (/** @type {any} */ e) => set({ color: hexToRgb(e.target.value) }, false) }),
      h('input', { id: id + '-sw', type: 'checkbox', role: 'switch', class: 'switch', checked: state.ownColor, onchange: (/** @type {any} */ e) => set({ ownColor: e.target.checked }, true) })))];
}

/** The "Custom colors" effect: pick a brush colour, then click keys on the keyboard picture. @param {import('./dom.js').Ctx} ctx */
function paintControls(ctx) {
  const rows = () => ctx.model.keymap.map((/** @type {[number, string]} */ [r]) => r);
  return [
    h('div', { class: 'control toggle-row', title: 'The color a clicked key gets.' },
      h('label', { for: 'brush' }, 'Brush color'),
      h('input', { id: 'brush', type: 'color', class: 'colorpick', 'aria-label': 'Brush color', value: rgbToHex(ctx.brush), oninput: (/** @type {any} */ e) => { ctx.brush = hexToRgb(e.target.value); } })),
    h('p', { class: 'hint' }, 'Click keys on the keyboard to paint them. Nothing is saved until you press Apply.'),
    h('div', { class: 'pair' },
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.paintKeys(rows(), ctx.brush) }, 'Fill all keys'),
      h('button', { type: 'button', class: 'btn', onclick: () => ctx.paintKeys(rows(), { r: 0, g: 0, b: 0 }) }, 'Clear all keys')),
  ];
}
