// Live preview of the backlight, logo and ambient effects. Pure functions: colour of one spot at one moment.
// These are approximations built from the effect names and the official capability table (speed, direction, colour),
// not a copy of the firmware: the UI labels the picture "preview".

/** @typedef {{r: number, g: number, b: number}} RGB */
/** @typedef {{effect: number, brightness: number, speed: number, dir?: number, ownColor: boolean, color: RGB}} LightState */
/** @typedef {{x: number, y: number, id: number, t0: number}} Press a simulated key press (typing effects) */

const TAU = Math.PI * 2;
const fract = (/** @type {number} */ v) => v - Math.floor(v);
const clamp01 = (/** @type {number} */ v) => Math.min(1, Math.max(0, v));
/** Deterministic pseudo-random number in 0..1. */
export const hash = (/** @type {number} */ a, /** @type {number} */ b = 0) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

/** @param {number} h 0..1 @param {number} s @param {number} v @returns {RGB} */
export function hsv(h, s, v) {
  const i = Math.floor(fract(h) * 6), f = fract(h) * 6 - i, p = v * (1 - s), q = v * (1 - f * s), u = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, u, p], [q, v, p], [p, v, u], [p, q, v], [u, p, v], [v, p, q]][i % 6];
  return { r: r * 255, g: g * 255, b: b * 255 };
}

/** cycles per second for speed levels 1..4 */
const RATE = [0.12, 0.2, 0.35, 0.6, 0.95];
const rateOf = (/** @type {number} */ speed) => RATE[Math.min(4, Math.max(1, Math.round(speed)))];

/** Scale a colour by 0..1 and round to whole 0-255 channels. @param {RGB} c @param {number} k */
const shade = (c, k) => ({ r: Math.round(clamp01(k * c.r / 255) * 255), g: Math.round(clamp01(k * c.g / 255) * 255), b: Math.round(clamp01(k * c.b / 255) * 255) });

/**
 * Colour of one key (or any point) for a backlight effect.
 * @param {number} effect effect id (see the model's lightEffects)
 * @param {{x: number, y: number, id: number}} pos x and y in 0..1 across the board, id = key row (for per-key randomness)
 * @param {number} t seconds
 * @param {LightState} p
 * @param {Press[]} [presses] simulated key presses for the typing effects
 * @returns {RGB}
 */
export function effectColor(effect, pos, t, p, presses = []) {
  const k = clamp01(p.brightness / 100);
  if (effect === 255 || k === 0) return { r: 0, g: 0, b: 0 };
  const rate = rateOf(p.speed), dir = p.dir ? -1 : 1;
  const own = p.ownColor ? p.color : null;
  const white = { r: 255, g: 255, b: 255 };
  /** Colour at a phase: the user's colour dimmed by the wave, or the rainbow. @param {number} phase 0..1 @param {number} v 0..1 */
  const wave = (phase, v = 1) => (own ? shade(own, 0.12 + 0.88 * v) : hsv(phase, 1, 0.35 + 0.65 * v));
  const dx = pos.x - 0.5, dy = (pos.y - 0.5) * 0.6, d = Math.hypot(dx, dy);
  const tt = t * rate;
  let c;
  switch (effect) {
    case 1: c = hsv(tt * 0.5 + pos.x * 0.12, 1, 1); break; // rainbow cycle (own colours only)
    case 2: c = shade(own ?? hsv(0.58, 0.9, 1), 1 - 0.75 * pos.x); break; // gradient, still
    case 3: c = own ?? white; break; // steady
    case 4: c = shade(own ?? white, 0.12 + 0.88 * (0.5 + 0.5 * Math.sin(tt * TAU))); break; // breathing
    case 5: c = hsv(hash(pos.id, Math.floor(tt * 3)), 1, 1); break; // disco
    case 6: c = wave(pos.x * 0.9 - dir * tt, 0.5 + 0.5 * Math.sin((pos.x * 1.1 - dir * tt) * TAU)); break; // horizontal wave
    case 7: c = wave(pos.y * 0.9 - dir * tt, 0.5 + 0.5 * Math.sin((pos.y * 1.4 - dir * tt) * TAU)); break; // vertical wave
    case 8: c = wave(d * 1.2 - dir * tt, 0.5 + 0.5 * Math.sin((d * 2 - dir * tt) * TAU)); break; // center burst
    case 10: c = wave(Math.atan2(dy, dx) / TAU + dir * tt, 0.5 + 0.5 * Math.sin((Math.atan2(dy, dx) / TAU + dir * tt) * TAU)); break; // center spiral
    case 11: { const y0 = 0.5 + 0.5 * Math.sin(tt * TAU); c = wave(pos.y, clamp01(1 - Math.abs(pos.y - y0) * 3.5)); break; } // rise and fall
    case 12: { const tri = Math.abs(fract(tt) * 2 - 1); c = wave(pos.x, clamp01(1 - Math.abs(pos.x - tri) * 4)); break; } // bounce
    case 18: c = wave((pos.x + pos.y) * 0.5 - tt, 0.5 + 0.5 * Math.sin(((pos.x + pos.y) * 0.9 - tt) * TAU)); break; // diagonal flow
    case 19: { const col = Math.floor(pos.x * 15), ph = fract(tt * 1.4 + hash(col)); c = wave(0.33 + hash(col) * 0.3, clamp01(1 - fract(ph - pos.y) * 3.2)); break; } // laser rain
    case 20: { const s = hash(pos.id, Math.floor(tt * 2)); c = wave(hash(pos.id, 3), s > 0.78 ? 1 - fract(tt * 2) : 0.06); break; } // sparkle
    case 9: { const s = hash(pos.id, Math.floor(tt * 2.5)); c = shade(own ?? white, 0.12 + (s > 0.8 ? 0.88 * (1 - fract(tt * 2.5)) : 0)); break; } // twinkling stars
    case 21: { const n = Math.floor(tt * 0.7), cx = 0.15 + 0.7 * hash(n), cy = 0.2 + 0.6 * hash(n, 1), r = fract(tt * 0.7) * 0.6, dist = Math.hypot(pos.x - cx, (pos.y - cy) * 0.6); c = wave(hash(n, 2), clamp01(1 - Math.abs(dist - r) * 9) * (1 - fract(tt * 0.7))); break; } // fireworks
    case 22: { const tri = Math.abs(fract(tt) * 2 - 1), diag = (pos.x + pos.y * 0.8) / 1.8; c = wave(diag, clamp01(1 - Math.abs(diag - tri) * 5)); break; } // triangle bounce
    case 13: case 14: case 15: case 16: case 17: { // typing effects: base glow + whatever the simulated presses are doing
      const base = effect === 14 ? 0.4 : 0.06;
      let v = base;
      for (const pr of presses) {
        const age = t - pr.t0;
        if (age < 0 || age > 1.6) continue;
        const dist = Math.hypot(pos.x - pr.x, (pos.y - pr.y) * 0.6);
        if (effect === 13 || effect === 14) v = Math.max(v, clamp01(1 - Math.abs(dist - age * 0.45) * 10) * (1 - age / 1.6));
        else if (effect === 15) v = Math.max(v, pos.id === pr.id ? Math.exp(-age * 2.2) : 0);
        else if (effect === 16) v = Math.max(v, clamp01(1 - Math.abs(dist - age * 0.3) * 14) * (1 - age / 1.6));
        else v = Math.max(v, Math.abs(pos.x - pr.x) < 0.04 ? clamp01(1 - age / 1.2) * (1 - Math.abs(pos.y - pr.y) * 0.4) : 0);
      }
      c = wave(hash(effect, Math.floor(t * 0.3)), Math.min(1, v));
      break;
    }
    default: c = own ?? white;
  }
  return shade(c, k);
}

/**
 * Colour of a side light (logo or ambient). "Follow" copies the backlight at the same spot.
 * @param {{follow: number, off: number, effects: {value: number}[]}} spec the model's sideLights entry
 * @param {{effect: number, brightness: number, speed: number, ownColor: boolean, color: RGB}} s
 * @param {LightState} main the backlight state (for "follow")
 * @param {{x: number, y: number, id: number}} pos
 * @param {number} t
 * @param {Press[]} [presses]
 * @param {number} [along] 0..1 position along a strip, so a flowing effect travels
 * @returns {RGB}
 */
export function sideColor(spec, s, main, pos, t, presses = [], along = pos.x) {
  if (s.effect === spec.follow) return effectColor(main.effect, pos, t, main, presses);
  const k = clamp01(s.brightness / 100);
  if (k === 0) return { r: 0, g: 0, b: 0 };
  const rate = rateOf(s.speed);
  const own = s.ownColor ? s.color : null;
  const index = spec.effects.findIndex(e => e.value === s.effect); // 0-based position in the model's list
  const kind = ['rainbow', 'breathing', 'steady', 'flowing'];
  // the model lists differ (logo: rainbow, breathing, steady; ambient: flowing, rainbow, breathing, steady), so map by name through the value order
  const names = spec.effects.length === 4 ? ['flowing', 'rainbow', 'breathing', 'steady'] : ['rainbow', 'breathing', 'steady'];
  const name = names[index] ?? kind[2];
  let c;
  if (name === 'rainbow') c = hsv(t * rate * 0.5, 1, 1);
  else if (name === 'breathing') c = shade(own ?? { r: 255, g: 255, b: 255 }, 0.12 + 0.88 * (0.5 + 0.5 * Math.sin(t * rate * TAU)));
  else if (name === 'flowing') c = own ? shade(own, 0.25 + 0.75 * (0.5 + 0.5 * Math.sin((along - t * rate) * TAU))) : hsv(along - t * rate * 0.5, 1, 1);
  else c = own ?? { r: 255, g: 255, b: 255 };
  return shade(c, k);
}

/** "rgb(r, g, b)" for a CSS custom property. @param {RGB} c */
export const css = c => `rgb(${c.r}, ${c.g}, ${c.b})`;
