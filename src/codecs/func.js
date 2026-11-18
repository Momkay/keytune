// Settings block, 64 bytes (cmd 5 read / cmd 6 write). Bit meanings from the official code, see PROTOCOL.md.

/** @param {ArrayLike<number>} e */
export function decodeFunc(e) {
  return {
    macMode: e[1] & 15, reportRate: e[4] & 15, tickRate: e[4] >> 4 & 15, deadZone: e[5],
    lockWin: e[6] & 1, lockAltTap: e[6] >> 1 & 1, lockAltF4: e[6] >> 2 & 1,
    tachyonMode: e[7] & 1, bottomRapidTrigger: e[7] >> 1 & 1, travelCheck: e[7] >> 2 & 1,
    debounceLevel: e[7] >> 5 & 7, rtsmart: e[20], sleepTime: e[35],
  };
}

/** Byte indexes the UI may change (settings, then the backlight at 8-12 and 14-16); every other byte is written back exactly as read. */
export const CHANGED = [4, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 20, 24, 25, 26, 27, 29, 30, 31, 35, 36, 44, 45, 46, 47, 49, 50, 51];

/** First byte of each side light's 8-byte group. Hub names: "logo" = LOGO灯 (bytes 44-51), "ambient" = 氛围灯 (bytes 24-31). */
export const SIDE_BASE = /** @type {const} */ ({ logo: 44, ambient: 24 });

/** @typedef {{effect: number, brightness: number, speed: number, ownColor: boolean, color: {r: number, g: number, b: number}}} Side */

/** One side light: effect, brightness 0-100, speed 1-4 (stored as 4 - level), own-colour switch (stored inverted), colour at +5..+7. @param {ArrayLike<number>} b @param {number} base @returns {Side} */
export const decodeSide = (b, base) => ({ effect: b[base], brightness: b[base + 1], speed: 4 - b[base + 2], ownColor: !b[base + 3], color: { r: b[base + 5], g: b[base + 6], b: b[base + 7] } });

/** @param {number[]} b @param {number} base @param {Side} s */
function encodeSide(b, base, s) {
  b[base] = s.effect; b[base + 1] = s.brightness; b[base + 2] = 4 - s.speed; b[base + 3] = s.ownColor ? 0 : 1;
  b[base + 5] = s.color.r; b[base + 6] = s.color.g; b[base + 7] = s.color.b;
}

/** @typedef {{effect: number, brightness: number, speed: number, dir: number, ownColor: boolean, color: {r: number, g: number, b: number}}} Light */

/**
 * @param {number[]} cur the block as read
 * @param {{rate: string, win: boolean, deb: number, cal: boolean, stab: boolean, rtOn: boolean, rtv: number, sleepMin: number, never: boolean, light?: Light, sides?: {logo: Side, ambient: Side}}} u
 */
export function encodeFunc(cur, u) {
  const b = cur.slice();
  if (u.rate !== '') b[4] = b[4] & 0xF0 | +u.rate;
  b[6] = b[6] & ~1 | (u.win ? 1 : 0);
  b[7] = b[7] & ~0xE6 | (u.deb & 7) << 5 | (u.cal ? 4 : 0) | (u.stab ? 2 : 0);
  b[20] = u.rtOn ? u.rtv : 0;
  b[35] = Math.round(u.sleepMin * 2);
  b[36] = u.never ? 1 : 0;
  if (u.light) { // backlight: speed is stored as 4 - level, and byte 12 is "use the effect's own colours" (inverted)
    const l = u.light;
    b[8] = l.effect; b[9] = l.brightness; b[10] = 4 - l.speed; b[11] = l.dir; b[12] = l.ownColor ? 0 : 1;
    b[14] = l.color.r; b[15] = l.color.g; b[16] = l.color.b;
  }
  if (u.sides) { encodeSide(b, SIDE_BASE.logo, u.sides.logo); encodeSide(b, SIDE_BASE.ambient, u.sides.ambient); }
  return b;
}

/** Throws if the block is outside what the hub allows. @param {number[]} next @param {number} deb requested debounce level */
export function validateFunc(next, deb) {
  if (!(next[20] >= 0 && next[20] <= 15)) throw new Error('RT stability must be 1-15');
  if (!(next[35] >= 2 && next[35] <= 60)) throw new Error('sleep must be 1-30 minutes');
  if ((next[7] >> 5 & 7) !== deb) throw new Error('debounce must be 0-7');
  if (next[9] > 100) throw new Error('brightness must be 0-100');
  if (next[10] > 3) throw new Error('light speed must be 1-4');
  if (next[11] > 1) throw new Error('light direction must be 0 or 1');
  if (next[12] > 1) throw new Error('own-colour switch must be 0 or 1');
  for (const base of Object.values(SIDE_BASE)) {
    if (next[base] > 6) throw new Error('side light effect is out of range');
    if (next[base + 1] > 100) throw new Error('side light brightness must be 0-100');
    if (next[base + 2] > 3) throw new Error('side light speed must be 1-4');
    if (next[base + 3] > 1) throw new Error('side light own-colour switch must be 0 or 1');
  }
}

/** Settings-screen values for a block; the inverse of encodeFunc. @param {number[]} b */
export function funcUiFromBlock(b) {
  return {
    rate: String(b[4] & 15), win: !!(b[6] & 1), deb: b[7] >> 5 & 7, cal: !!(b[7] >> 2 & 1), stab: !!(b[7] >> 1 & 1),
    rtOn: b[20] > 0, rtv: b[20] || 5, sleepMin: b[35] / 2, never: b[36] === 1,
    /** @type {Light} */
    light: { effect: b[8], brightness: b[9], speed: 4 - b[10], dir: b[11], ownColor: !b[12], color: { r: b[14], g: b[15], b: b[16] } },
    sides: { logo: decodeSide(b, SIDE_BASE.logo), ambient: decodeSide(b, SIDE_BASE.ambient) },
  };
}
