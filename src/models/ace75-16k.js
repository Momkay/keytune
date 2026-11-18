// Ace 75 16K: NOT verified on hardware, so the app treats it as read-only.
// The physical layout, key table and limits are copied from the 8K as an assumption; nothing here has been checked against a real 16K.
import { ace75_8k } from './ace75-8k.js';

export const ace75_16k = {
  ...ace75_8k,
  name: 'Ace 75 16K',
  verified: false,
  pid: 0x301D, // from the official device table (boot PID 0x301F); also marked "testing" there
};
