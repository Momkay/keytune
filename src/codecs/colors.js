// Stored per-key colours (cmd 10 read / cmd 11 write): 3 bytes [r, g, b] per key row, one 512-byte area per profile.
// The keyboard shows this table while the backlight effect is 0 ("custom colors"); see PROTOCOL.md "S1".
export const COLOR_AREA = 512;

/** @typedef {{r: number, g: number, b: number}} Rgb */

/** Byte offset of one key's colour (cmd 11 write). @param {number} profile @param {number} row matrix row */
export const colorOffset = (profile, row) => COLOR_AREA * profile + 3 * row;

/** @param {ArrayLike<number>} bytes @param {number} count @returns {Rgb[]} */
export const decodeColors = (bytes, count) => Array.from({ length: count }, (_, i) => ({ r: bytes[3 * i], g: bytes[3 * i + 1], b: bytes[3 * i + 2] }));

/** @param {Rgb} c */
export const encodeColor = c => [c.r, c.g, c.b];

/** @param {Rgb} c */
export const isColor = c => !!c && [c.r, c.g, c.b].every(v => Number.isInteger(v) && v >= 0 && v <= 255);
