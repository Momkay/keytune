// Frame B, report ID 0 (see PROTOCOL.md). Request: [0x55, cmd, 0, chk, len, offLo, offHi, 0, ...data]
export const sum8 = (/** @type {ArrayLike<number>} */ a) => Array.from(a).reduce((x, y) => x + y, 0) & 255;

/**
 * @param {number} cmd @param {number} offset @param {number} len @param {number[]} [data]
 */
export function buildRequest(cmd, offset, len, data = []) {
  const head = [len, offset & 255, offset >> 8, 0, ...data];
  const pkt = new Uint8Array(64);
  pkt.set([0x55, cmd, 0, sum8(head), ...head]);
  return pkt;
}

export const hex = (/** @type {ArrayLike<number>} */ a) => Array.from(a).map(b => b.toString(16).padStart(2, '0')).join(' ');

/**
 * Returns null if the packet is not the reply to `cmd`; throws on a bad checksum.
 * The reply's own length byte is used, because the device can answer with fewer bytes than asked.
 * Write acks (`isWrite`) are not checksummed, as in the verified page.
 * @param {Uint8Array} r @param {number} cmd @param {number} offset @param {boolean} isWrite
 */
export function parseReply(r, cmd, offset, isWrite) {
  if (r[0] !== 0xAA || r[1] !== cmd) return null;
  if (!isWrite && (r[5] | r[6] << 8) !== offset) return null; // replies echo the request offset; a reply for another request is not ours
  const n = r[4];
  const body = Array.from(r.slice(8, 8 + n));
  if (!isWrite && sum8([n, offset & 255, offset >> 8, ...body]) !== r[3]) {
    throw new Error(`bad checksum (cmd ${cmd}, offset ${offset}), reply: ` + hex(r));
  }
  return body;
}
