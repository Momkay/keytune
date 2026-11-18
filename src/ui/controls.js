// Small form controls shared by the panels. Each returns an element; values are reported through callbacks.
import { h } from './dom.js';

let uid = 0;

/**
 * A labelled slider with a live readout.
 * @param {{label: string, hint?: string, min: number, max: number, step: number, value: number, mixed?: boolean, format: (v: number) => string, onInput: (v: number) => void}} o
 */
export function slider(o) {
  const id = 'sl' + ++uid;
  const out = h('output', { class: 'readout', for: id }, o.mixed ? 'Mixed' : o.format(o.value));
  const input = h('input', {
    id, type: 'range', min: o.min, max: o.max, step: o.step, value: o.value, 'aria-describedby': o.hint ? id + 'h' : null,
    oninput: (/** @type {any} */ e) => { const v = Number(e.target.value); out.textContent = o.format(v); o.onInput(v); },
  });
  return h('div', { class: 'control', title: o.hint }, h('div', { class: 'control-head' }, h('label', { for: id }, o.label), out),
    input,
    o.hint && h('p', { class: 'hint', id: id + 'h' }, o.hint));
}

/**
 * A row of exclusive choices (like radio buttons). `value` of null shows none selected.
 * @param {{label: string, hint?: string, options: [string, string][], value: string | null, onChange: (v: string) => void}} o
 */
export function segmented(o) {
  const id = 'sg' + ++uid;
  const btns = o.options.map(([v, text]) => h('button', {
    type: 'button', 'aria-pressed': v === o.value, class: v === o.value ? 'seg on' : 'seg',
    onclick: () => o.onChange(v),
  }, text));
  return h('div', { class: 'control', title: o.hint }, h('div', { class: 'control-head' }, h('span', { id }, o.label)),
    h('div', { class: 'segmented', role: 'group', 'aria-labelledby': id }, btns),
    o.hint && h('p', { class: 'hint' }, o.hint));
}

/** An on/off switch with a label and an explanation. @param {{label: string, hint?: string, checked: boolean, onChange: (v: boolean) => void}} o */
export function toggle(o) {
  const id = 'tg' + ++uid;
  return h('div', { class: 'control toggle-row', title: o.hint },
    h('div', {}, h('label', { for: id }, o.label), o.hint && h('p', { class: 'hint', id: id + 'h' }, o.hint)),
    h('input', { id, type: 'checkbox', role: 'switch', class: 'switch', checked: o.checked, 'aria-describedby': o.hint ? id + 'h' : null,
      onchange: (/** @type {any} */ e) => o.onChange(e.target.checked) }));
}
