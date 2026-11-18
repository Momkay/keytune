// Drives the live light preview: every frame it asks effects.js for the colour of each key, the logo key and the strip.
import { effectColor, sideColor, css, hash } from './effects.js';

/** Point on the case edge for strip sample i of n, as a fraction of the board (clockwise from the top left). @param {number} i @param {number} n */
export function perimeterPoint(i, n) {
  const p = (i / n) * 4;
  if (p < 1) return { x: p, y: 0 };
  if (p < 2) return { x: 1, y: p - 1 };
  if (p < 3) return { x: 3 - p, y: 1 };
  return { x: 0, y: 4 - p };
}

/** The stored colour at the keyboard's brightness. @param {{r: number, g: number, b: number}} c @param {number} k 0..1 */
const scale = (c, k) => ({ r: c.r * k, g: c.g * k, b: c.b * k });

/** A conic gradient from a list of colours, closing the loop. @param {string[]} colors */
export const conic = colors => `conic-gradient(from 0deg, ${[...colors, colors[0]].map((c, i, a) => `${c} ${Math.round((i / (a.length - 1)) * 100)}%`).join(', ')})`;

/**
 * @param {{
 *   kb: {spots: () => {row: number, cx: number, cy: number}[], setLit: (row: number, c: string) => void, setLogo: (c: string) => void, setStrip: (c: string) => void, setBar: (c: string) => void},
 *   model: any,
 *   getState: () => {light: any, sides: {logo: any, ambient: any}, colors?: {r: number, g: number, b: number}[]},
 * }} o
 */
export function createPreview({ kb, model, getState }) {
  const logoSpec = model.sideLights.find((/** @type {{key: string}} */ s) => s.key === 'logo');
  const ambientSpec = model.sideLights.find((/** @type {{key: string}} */ s) => s.key === 'ambient');
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const origin = performance.now();
  /** @type {{x: number, y: number, id: number, t0: number}[]} */
  let presses = [];
  let lastPress = -1, raf = 0, last = 0;

  /** Simulated typing for the key-reactive effects: one press about every 0.8 s, at a repeatable random key. @param {number} t */
  function demoPresses(t) {
    const n = Math.floor(t / 0.8);
    if (n !== lastPress) {
      lastPress = n;
      const spots = kb.spots(), s = spots[Math.floor(hash(n, 9) * spots.length)];
      if (s) presses = [...presses.slice(-5), { x: s.cx, y: s.cy, id: s.row, t0: t }];
    }
  }

  /** Paint one frame at time t (seconds). @param {number} t */
  function frame(t) {
    const { light, sides, colors } = getState();
    demoPresses(t);
    for (const s of kb.spots()) {
      const c = light.effect === 0 ? scale(colors?.[s.row] ?? { r: 0, g: 0, b: 0 }, light.brightness / 100) : effectColor(light.effect, { x: s.cx, y: s.cy, id: s.row }, t, light, presses);
      kb.setLit(s.row, css(c));
    }
    kb.setLogo(css(sideColor(logoSpec, sides.logo, light, { x: 0.97, y: 0.8, id: -1 }, t, presses, 0.5)));
    const N = 16, stops = [];
    for (let i = 0; i < N; i++) {
      const p = perimeterPoint(i, N);
      stops.push(css(sideColor(ambientSpec, sides.ambient, light, { x: p.x, y: p.y, id: -2 }, t, presses, i / N)));
    }
    kb.setStrip(conic(stops));
    const bar = [];
    for (let i = 0; i < N; i++) bar.push(css(sideColor(ambientSpec, sides.ambient, light, { x: i / (N - 1), y: 0.12, id: -3 }, t, presses, i / N)));
    kb.setBar(`linear-gradient(90deg, ${bar.join(', ')})`);
  }

  /** @param {number} now */
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (now - last < 33) return; // about 30 frames a second is plenty for a preview
    last = now;
    frame((now - origin) / 1000);
  }

  return {
    /** Start animating (or paint one still frame when the user prefers reduced motion). */
    start() { if (reduced) { frame(0.7); return; } if (!raf) raf = requestAnimationFrame(tick); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    /** Paint straight away after a setting changed (also what reduced-motion users see). */
    refresh() { frame(reduced ? 0.7 : (performance.now() - origin) / 1000); },
  };
}
