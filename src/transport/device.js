// The only module allowed to call sendReport. Every request is checked against the allowlist first.
import { isAllowed } from './allowlist.js';
import { buildRequest, parseReply } from './frame.js';

export const CMD = { INFO: 3, BASE_GET: 4, FUNC_GET: 5, FUNC_SET: 6, MATRIX_DEFAULT: 7, MATRIX: 8, MATRIX_SET: 9, LIGHT_GET: 10, LIGHT_SET: 11, BASE_SET: 14, KEY_GET: 0xA0, KEY_SET: 0xA1 };

/**
 * One request/reply exchange.
 * @param {HIDDevice} dev @param {number} cmd @param {number} offset @param {number} len @param {number[]} [data]
 * @returns {Promise<number[]>}
 */
export function exchange(dev, cmd, offset, len, data = []) {
  return new Promise((resolve, reject) => {
    if (!isAllowed(cmd)) return reject(new Error(`command ${cmd} is not allowed`));
    /** @type {(f: (v: any) => void, v: any) => void} */
    const done = (f, v) => { clearTimeout(t); dev.removeEventListener('inputreport', on); f(v); };
    const t = setTimeout(() => done(reject, new Error(`timeout (cmd ${cmd}, offset ${offset})`)), 1500);
    const on = (/** @type {HIDInputReportEvent} */ e) => {
      try {
        const body = parseReply(new Uint8Array(e.data.buffer), cmd, offset, data.length > 0);
        if (body) done(resolve, body);
      } catch (err) { done(reject, err); }
    };
    dev.addEventListener('inputreport', on);
    dev.sendReport(0, buildRequest(cmd, offset, len, data)).catch(e => done(reject, e));
  });
}

/** @param {HIDDevice} dev @param {number} cmd @param {number} offset @param {number} size */
export async function readBlock(dev, cmd, offset, size) {
  /** @type {number[]} */
  const out = [];
  for (let o = 0; o < size; o += 56) out.push(...await exchange(dev, cmd, offset + o, Math.min(56, size - o)));
  return out;
}
