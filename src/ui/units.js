// The keyboard stores distances in 0.01 mm; people think in millimetres.
export const toMm = (/** @type {number} */ raw) => (raw / 100).toFixed(2) + ' mm';

/** Millimetres typed or dragged by the user -> raw units, kept inside the model's limits. @param {number} mm @param {[number, number]} limit */
export const fromMm = (mm, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(mm * 100)));
