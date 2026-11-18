// @ts-nocheck: reason: partial HID stub; typing it as a full HIDDevice would be bigger than the mock
import { sum8 } from '../../src/transport/frame.js';

/** Stateful mock keyboard: 1024-byte key memory (cmd 0xA0/0xA1) and 64-byte settings block (cmd 5/6). */
/** @returns {any} */
export function mockKeyboard({ keys = new Array(1024).fill(0), func = new Array(64).fill(0), matrix = new Array(4096).fill(0), dropWrites = false } = {}) {
  const mem = { 0xa0: keys, 5: func, 8: matrix, 7: matrix.slice(), 3: new Array(56).fill(0), 10: new Array(1536).fill(0), 4: [1, 3, 0, 1, 2, ...new Array(51).fill(0)] }; // 7 = factory matrix, a copy that writes never touch
  const listeners = new Set(); const sent = [];
  return {
    keys, func, matrix, sent, colors: mem[10],
    addEventListener: (_t, f) => listeners.add(f),
    removeEventListener: (_t, f) => listeners.delete(f),
    async sendReport(_id, pkt) {
      sent.push(Array.from(pkt));
      const [, cmd, , , len, lo, hi] = pkt; const off = lo | hi << 8;
      const target = cmd === 0xa1 ? mem[0xa0] : cmd === 6 ? mem[5] : cmd === 9 ? mem[8] : cmd === 14 ? mem[4] : cmd === 11 ? mem[10] : mem[cmd];
      let body;
      if (cmd === 0xa1 || cmd === 6 || cmd === 9 || cmd === 14 || cmd === 11) { if (!dropWrites) target.splice(off, len, ...pkt.slice(8, 8 + len)); body = []; }
      else body = target.slice(off, off + len);
      const r = new Uint8Array(64); r.set([0xaa, cmd, 0, sum8([body.length, lo, hi, ...body]), body.length, lo, hi, 0, ...body]);
      for (const f of listeners) f({ data: { buffer: r.buffer } });
    },
  };
}
