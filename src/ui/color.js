// Colour helpers for the colour input (which speaks "#rrggbb").
/** @param {{r: number, g: number, b: number}} c */
export const rgbToHex = c => '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('');

/** @param {string} hex "#rrggbb" */
export function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error('colour must look like #rrggbb');
  const n = parseInt(m[1], 16);
  return { r: n >> 16, g: n >> 8 & 255, b: n & 255 };
}
