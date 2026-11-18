// Changes the user has made but not applied yet. Pure functions; nothing here touches the keyboard.
import { encodeFunc, CHANGED } from '../codecs/func.js';

/** @typedef {{type: number, code1: number, code2: number}} Entry */
/** @typedef {{keys: Map<number, Record<string, number>>, remap: Map<string, {layer: number, row: number, to: Entry | 'factory'}>, func: any, colors: Map<number, {r: number, g: number, b: number}>}} Pending */

/** @returns {Pending} */
export const emptyPending = () => ({ keys: new Map(), remap: new Map(), func: null, colors: new Map() });

/** @param {Pending} p @param {Record<number, any>} cur @param {number} row */
export const effectiveKey = (p, cur, row) => ({ ...cur[row], ...p.keys.get(row) });

/**
 * Merge `patch` into the staged changes of every row; a field that equals the live value is dropped, and so is an empty row.
 * @param {Pending} p @param {Record<number, any>} cur @param {number[]} rows @param {Record<string, number>} patch
 */
export function stageKeys(p, cur, rows, patch) {
  for (const row of rows) {
    const next = { ...p.keys.get(row), ...patch };
    for (const f of Object.keys(next)) if (next[f] === cur[row][f]) delete next[f];
    if (Object.keys(next).length) p.keys.set(row, next); else p.keys.delete(row);
  }
}

/** @param {Pending} p @param {number} layer @param {number} row @param {Entry | 'factory' | null} to null clears the staged remap */
export function stageRemap(p, layer, row, to) {
  const id = `${layer}:${row}`;
  if (to) p.remap.set(id, { layer, row, to }); else p.remap.delete(id);
}

/** Stage the settings screen's values; cleared when they equal what the keyboard has. @param {Pending} p @param {number[]} block @param {any} ui */
export function stageFunc(p, block, ui) {
  const next = encodeFunc(block, ui);
  p.func = CHANGED.some(i => next[i] !== block[i]) ? ui : null;
}

/** Stage painted colours; a colour equal to the stored one is dropped. @param {Pending} p @param {{r: number, g: number, b: number}[]} cur @param {number[]} rows @param {{r: number, g: number, b: number}} c */
export function stageColors(p, cur, rows, c) {
  for (const row of rows) {
    const o = cur[row];
    if (o && o.r === c.r && o.g === c.g && o.b === c.b) p.colors.delete(row); else p.colors.set(row, { ...c });
  }
}

/** @param {Pending} p */
export const changeCounts = p => ({ keys: p.keys.size, remap: p.remap.size, settings: p.func ? 1 : 0, colors: p.colors.size });

/** @param {Pending} p */
export const isEmpty = p => !p.keys.size && !p.remap.size && !p.func && !p.colors.size;

/** One short sentence for the Apply bar. @param {Pending} p */
export function summary(p) {
  const { keys, remap, settings, colors } = changeCounts(p);
  const parts = [];
  if (keys) parts.push(`${keys} key${keys > 1 ? 's' : ''} with new sensitivity`);
  if (remap) parts.push(`${remap} remapped key${remap > 1 ? 's' : ''}`);
  if (colors) parts.push(`${colors} painted key${colors > 1 ? 's' : ''}`);
  if (settings) parts.push('settings and lighting');
  return parts.join(' · ');
}
