// 7 and 8 are read-only key-matrix reads (factory default, live), added for the remap decode. 9 writes one 3-byte key matrix entry (remap), only called from writeMatrixKey.
// Command bytes the transport may send. Anything else (firmware, boot, reset) is refused.
export const ALLOWED_COMMANDS = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 0xa0, 0xa1]);

/** @param {number} cmd */
export const isAllowed = (cmd) => ALLOWED_COMMANDS.has(cmd);
