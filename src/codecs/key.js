const u16 = (/** @type {number} */ lo, /** @type {number} */ hi) => lo | hi << 8;

/** @param {ArrayLike<number>} b 8-byte key trigger struct */
export function decodeKey(b) {
  return {
    switchType: b[0] & 15, keyMode: b[1] & 15, priority: b[1] >> 4,
    actuation: u16(b[2], b[3] & 1) + 1, pressPrecision: b[3] >> 3 & 3, releasePrecision: b[3] >> 1 & 3,
    rtPress: u16(b[4], b[5] & 1) + 1, pressDeadzone: b[5] >> 1 & 127,
    rtRelease: u16(b[6], b[7] & 1) + 1, releaseDeadzone: b[7] >> 1 & 127,
  };
}

/** @param {ReturnType<typeof decodeKey>} k */
export function encodeKey(k) {
  const a = Math.max(0, k.actuation - 1), p = Math.max(0, k.rtPress - 1), r = Math.max(0, k.rtRelease - 1);
  return [
    0xA0 | k.switchType, k.priority << 4 | k.keyMode,
    a & 255, a >> 8 & 1 | (k.pressPrecision & 3) << 3 | (k.releasePrecision & 3) << 1,
    p & 255, p >> 8 & 1 | k.pressDeadzone << 1,
    r & 255, r >> 8 & 1 | k.releaseDeadzone << 1,
  ];
}
