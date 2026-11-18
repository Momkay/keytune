// @ts-nocheck: reason: the mock HID device is a partial stub; typing it as a full HIDDevice would be bigger than the mock
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exchange, readBlock, CMD } from '../src/transport/device.js';
import { ALLOWED_COMMANDS } from '../src/transport/allowlist.js';
import { sum8 } from '../src/transport/frame.js';

/** Mock HID device: answers each request with the given body for that command. */
function mock(bodyFor, { silent = false, fail = false } = {}) {
  const l = new Set(); const sent = [];
  return {
    sent,
    addEventListener: (_t, f) => l.add(f),
    removeEventListener: (_t, f) => l.delete(f),
    async sendReport(_id, pkt) {
      if (fail) throw new Error('usb gone');
      sent.push(Array.from(pkt));
      if (silent) return;
      const [, cmd, , , len, lo, hi] = pkt; const body = bodyFor(cmd, len);
      const r = new Uint8Array(64); r.set([0xaa, cmd, 0, sum8([body.length, lo, hi, ...body]), body.length, lo, hi, 0, ...body]);
      for (const f of l) f({ data: { buffer: r.buffer } });
    },
  };
}

test('every command byte outside the allowlist is refused without sending', async () => {
  for (let cmd = 0; cmd < 256; cmd++) {
    if (ALLOWED_COMMANDS.has(cmd)) continue;
    const dev = mock(() => []);
    await assert.rejects(exchange(dev, cmd, 0, 8), /not allowed/);
    assert.equal(dev.sent.length, 0);
  }
});

test('exchange returns the reply body', async () => {
  const dev = mock(() => [1, 2, 3]);
  assert.deepEqual(await exchange(dev, CMD.INFO, 0, 56), [1, 2, 3]);
});

test('readBlock chunks by 56 bytes', async () => {
  const dev = mock((_c, len) => new Array(len).fill(7));
  assert.equal((await readBlock(dev, CMD.KEY_GET, 0, 1024)).length, 1024);
  assert.equal(dev.sent.length, 19);
});

test('timeout, send failure and bad checksum reject', async () => {
  await assert.rejects(exchange(mock(() => [], { silent: true }), CMD.INFO, 0, 8), /timeout/);
  await assert.rejects(exchange(mock(() => [], { fail: true }), CMD.INFO, 0, 8), /usb gone/);
  const l = new Set();
  const bad = { addEventListener: (_t, f) => l.add(f), removeEventListener() {}, sendReport: async () => { const r = new Uint8Array(64); r.set([0xaa, 3, 0, 0, 1, 0, 0, 0, 9]); for (const f of l) f({ data: { buffer: r.buffer } }); } };
  await assert.rejects(exchange(bad, CMD.INFO, 0, 8), /bad checksum/);
});
