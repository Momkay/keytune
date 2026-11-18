import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, parseReply } from '../src/transport/frame.js';

// real bytes from the keyboard (PROTOCOL.md): read key row 0
const REQ = [0x55, 0xa0, 0, 0x08, 0x08, 0, 0, 0];
const REPLY = Uint8Array.from([0xaa, 0xa0, 0, 0xb3, 0x08, 0, 0, 0, 0xa0, 0, 0x95, 0, 0x1d, 0x1e, 0x1d, 0x1e]);

test('request golden vector', () => {
  const p = buildRequest(0xa0, 0, 8);
  assert.equal(p.length, 64);
  assert.deepEqual(Array.from(p.slice(0, 8)), REQ);
});

test('reply golden vector', () => {
  assert.deepEqual(parseReply(REPLY, 0xa0, 0, false), [0xa0, 0, 0x95, 0, 0x1d, 0x1e, 0x1d, 0x1e]);
});

test('bad checksum throws, other commands are ignored, write acks skip the checksum', () => {
  const bad = Uint8Array.from(REPLY); bad[3] ^= 1;
  assert.throws(() => parseReply(bad, 0xa0, 0, false), /bad checksum/);
  assert.equal(parseReply(REPLY, 5, 0, false), null);
  assert.equal(parseReply(Uint8Array.from([0x55, 0xa0]), 0xa0, 0, false), null);
  assert.equal(parseReply(bad, 0xa0, 0, true)?.length, 8);
});

test('checksum uses the reply length byte, not the requested one (synthetic short reply)', () => {
  const body = [1, 2, 3];
  const r = new Uint8Array(64); r.set([0xaa, 3, 0, 3 + 6, 3, 0, 0, 0, ...body]);
  assert.deepEqual(parseReply(r, 3, 0, false), body);
});

test('a reply for a different offset is ignored (concurrent reads must not cross)', () => {
  // real reply captured when two layer reads overlapped: it answers offset 0x600, not 0
  const other = Uint8Array.from([0xaa, 0x08, 0x00, 0x65, 0x38, 0x00, 0x06, 0x00, 0x10, 0x00, 0x34]);
  assert.equal(parseReply(other, 8, 0, false), null);
  assert.equal(parseReply(REPLY, 0xa0, 0, false)?.length, 8); // offset echo 0 matches
});

test('cmd 3 golden vector: a real reply is 31 bytes (asked for 56) and checksums to 0x28', () => {
  // read from the keyboard 2026-11-18: firmware 0x18 0x01 then the build string "Jul 30 2026,17:07:58GL8KH-PRO"
  const body = '18 01 4a 75 6c 20 33 30 20 32 30 32 36 2c 31 37 3a 30 37 3a 35 38 47 4c 38 4b 48 2d 50 52 4f'.split(' ').map(h => parseInt(h, 16));
  const r = new Uint8Array(64); r.set([0xaa, 3, 0, 0x28, 31, 0, 0, 0, ...body]);
  assert.deepEqual(parseReply(r, 3, 0, false), body);
  assert.equal(buildRequest(3, 0, 56)[3], 56); // the request still asks for 56; the reply's own length (31) is what the checksum uses
});
