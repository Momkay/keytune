// The Ace 75 picture: case, keys, the logo key and the LED strip. Built once; paint() updates labels and states,
// and the light preview drives the colours through setLit() / setLogo() / setStrip().
import { h } from './dom.js';
import { layoutRows, spokenName } from './layout.js';
import { logo } from './icons.js';

/**
 * @param {any} model
 * @param {(row: number, e: MouseEvent) => void} onKey
 * @param {() => void} [onLogo] called when the logo key is clicked
 */
export function buildKeyboard(model, onKey, onLogo = () => {}) {
  /** @type {Map<number, {btn: any, main: any, sub: any, cx: number, cy: number}>} */
  const keys = new Map();
  /** @type {any} */
  let logoBtn = null;
  const cap = (/** @type {{name?: string, row?: number, w: number, label?: string, kind?: string, cx: number, cy: number}} */ k) => {
    if (k.kind === 'logo') {
      logoBtn = h('button', { class: 'key logo-key', type: 'button', style: { '--w': k.w }, 'aria-label': 'Logo light', onclick: () => onLogo() }, h('span', { class: 'face' }, logo(18)));
      return logoBtn;
    }
    if (k.row === undefined || !k.name) return h('span', { class: 'gap', style: { '--w': k.w } });
    const main = h('span', { class: 'main' }, k.label), sub = h('span', { class: 'sub' });
    const btn = h('button', { class: 'key', type: 'button', tabIndex: -1, style: { '--w': k.w }, 'aria-label': spokenName(k.name), 'data-name': spokenName(k.name), onclick: (/** @type {MouseEvent} */ e) => onKey(/** @type {number} */ (k.row), e) },
      h('span', { class: 'face' }, main, sub));
    keys.set(k.row, { btn, main, sub, cx: k.cx, cy: k.cy });
    return btn;
  };
  const board = h('div', { class: 'board', role: 'group', 'aria-label': 'Keyboard' }, layoutRows(model).flatMap((r, i) => [h('div', { class: 'krow' }, r.map(cap)), i === 0 && model.lightBar && h('div', { class: 'lightbar', 'aria-hidden': 'true' })]));
  const extras = h('div', { class: 'extras', role: 'group', 'aria-label': 'Extra keys' }, model.extras.map((/** @type {string} */ name) => {
    const row = model.keymap.find((/** @type {[number, string]} */ [, n]) => n === name)[0];
    return cap({ name, row, w: 1.5, label: name === 'RT' ? 'RT key' : name, cx: 0.5, cy: 1 });
  }));
  const strip = h('div', { class: 'strip', 'aria-hidden': 'true' });
  const shell = h('div', { class: 'case' }, strip, board);
  const el = h('div', { class: 'kb' }, shell, extras);

  // One tab stop for the whole keyboard (roving tabindex); arrow keys move between keys by position on screen.
  /** @type {any[]} */
  const all = [...keys.values()].map(k => k.btn);
  /** @param {any} btn */
  const setStop = btn => { for (const b of all) b.tabIndex = b === btn ? 0 : -1; };
  if (all.length) setStop(all[0]);
  for (const b of all) b.addEventListener('focus', () => setStop(b));
  el.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
    const dir = /** @type {Record<string, [number, number]>} */ ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] })[e.key];
    const from = all.find(b => b === document.activeElement);
    if (!dir || !from) return;
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const b of all) {
      if (b === from) continue;
      const r = b.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const along = dx * dir[0] + dy * dir[1], across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
      if (along <= 1) continue; // not in that direction
      const score = along + across * 3;
      if (score < bestScore) { best = b; bestScore = score; }
    }
    if (best) { e.preventDefault(); best.focus(); }
  });

  /**
   * @param {(row: number) => {main: string, sub?: string, desc?: string, selected?: boolean, changed?: boolean, locked?: boolean}} info
   */
  function paint(info) {
    for (const [row, k] of keys) {
      const i = info(row);
      k.main.textContent = i.main;
      k.main.dataset.long = i.main.length > 5 ? '1' : '';
      k.sub.dataset.sub = i.sub ?? ''; // drawn by CSS, so the key's text is only its label (WCAG 2.5.3 label in name)
      k.btn.classList.toggle('selected', !!i.selected);
      k.btn.classList.toggle('changed', !!i.changed);
      k.btn.classList.toggle('locked', !!i.locked);
      k.btn.setAttribute('aria-pressed', i.selected ? 'true' : 'false');
      // the spoken name starts with the printed label, then says which key it is when they differ, then the state
      const spoken = k.btn.dataset.name;
      k.btn.setAttribute('aria-label', `${i.main}${i.main !== spoken ? ` (${spoken} key)` : ''}${i.desc ? `, ${i.desc}` : ''}`);
    }
  }

  return {
    el, paint,
    /** key rows with their centre on the board, for the light preview */
    spots: () => [...keys.entries()].map(([row, k]) => ({ row, cx: k.cx, cy: k.cy })),
    /** Colour one key's light. @param {number} row @param {string} color a CSS colour */
    setLit(row, color) { keys.get(row)?.btn.style.setProperty('--lit', color); },
    /** Colour the logo key. @param {string} color */
    setLogo(color) { logoBtn?.style.setProperty('--lit', color); },
    /** Colour the light bar under the function row with a CSS background. @param {string} background */
    setBar(background) { board.querySelector('.lightbar')?.style.setProperty('--bar', background); },
    /** Colour the strip around the case with a CSS background (a colour or a gradient). @param {string} background */
    setStrip(background) { strip.style.setProperty('--strip', background); },
    /** Show the light as the key colour (Lighting section) or as a soft glow (other sections). @param {boolean} full */
    setLightMode(full) { el.classList.toggle('lit-full', full); },
  };
}
