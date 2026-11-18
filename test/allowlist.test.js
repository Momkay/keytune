import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed } from '../src/transport/allowlist.js';

test('only the twelve allowlisted command bytes pass', () => {
  for (let cmd = 0; cmd < 256; cmd++) {
    assert.equal(isAllowed(cmd), [3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 0xa0, 0xa1].includes(cmd), `cmd ${cmd}`);
  }
});
// 14 writes the 56-byte base block (active profile), only called from writeActiveProfile.
// 10 reads the stored per-key colour table (read-only for now: spike S1). 11 writes one key's colour (3 bytes), only called from writeColors.
