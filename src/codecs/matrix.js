// Key matrix (cmd 8 live / cmd 7 factory default): 3 bytes per key [type, code1, code2], at offset 512 * layerIndex.
// layerIndex = 4 * profile + layer. Type 16 is a plain keyboard key (code2 = HID usage); other types are kept raw until decoded.
export const MATRIX_STRIDE = 512;
export const LAYERS = 4;

/** Byte offset of one key's entry (cmd 8 read / cmd 9 write). @param {number} layer 0..3 @param {number} key matrix row */
export const matrixOffset = (layer, key) => MATRIX_STRIDE * layer + 3 * key;

/** @param {{type: number, code1: number, code2: number}} e */
export const encodeEntry = e => [e.type, e.code1, e.code2];

/** @param {ArrayLike<number>} bytes @param {number} count */
export function decodeMatrix(bytes, count) {
  if (bytes.length < count * 3) throw new Error(`matrix data too short: ${bytes.length} < ${count * 3}`);
  return Array.from({ length: count }, (_, i) => ({ type: bytes[3 * i], code1: bytes[3 * i + 1], code2: bytes[3 * i + 2] }));
}

// Entry types seen on the Ace 75 8K (PROTOCOL.md): 16 = keyboard key (code1 = modifier bitmask, code2 = HID usage),
// 48 = consumer/media usage (code1 = usage low byte), 240 = special/FN function id, 0 = unassigned.
const KEY = 16, CONSUMER = 48, SPECIAL = 240;
/** @type {[number, string][]} */
const MODS = [[1, 'LCtrl'], [2, 'LShift'], [4, 'LAlt'], [8, 'Win'], [16, 'RCtrl'], [32, 'RShift'], [64, 'RAlt'], [128, 'RWin']];
/** @type {Map<number, string>} */
const NAMED = new Map([[40, 'Enter'], [41, 'Esc'], [42, 'Bksp'], [43, 'Tab'], [44, 'Space'], [45, '-'], [46, '='], [47, '['], [48, ']'], [49, '\\'],
  [51, ';'], [52, "'"], [53, '~'], [54, ','], [55, '.'], [56, '/'], [57, 'Caps'], [70, 'PrtSc'], [71, 'ScrLk'], [72, 'Pause'], [73, 'Ins'],
  [74, 'Home'], [75, 'PgUp'], [76, 'Delete'], [77, 'End'], [78, 'PgDn'], [79, 'Right'], [80, 'Left'], [81, 'Down'], [82, 'Up']]);
/** @type {Map<number, string>} */
const CONSUMER_NAMES = new Map([[226, 'Mute'], [233, 'Vol+'], [234, 'Vol-'], [205, 'Play/Pause'], [181, 'Next'], [182, 'Prev'], [111, 'Bright+'], [112, 'Bright-']]);

// special ids confirmed against the hub's Win Fn layer icons; the others stay raw
/** @type {Map<number, string>} */
const SPECIAL_NAMES = new Map([[4, 'Win mode'], [5, 'Mac mode']]);

/** @param {number} u HID keyboard usage */
const usageName = u => u >= 4 && u <= 29 ? String.fromCharCode(61 + u) : u >= 30 && u <= 38 ? String(u - 29) : u === 39 ? '0'
  : u >= 58 && u <= 69 ? `F${u - 57}` : NAMED.get(u) ?? `key 0x${u.toString(16)}`;

/** Human label for one matrix entry. @param {{type: number, code1: number, code2: number}} e */
export function describeEntry({ type, code1, code2 }) {
  if (type === 0) return '';
  if (type === KEY) {
    const mods = MODS.filter(([bit]) => code1 & bit).map(([, n]) => n);
    return [...mods, ...(code2 ? [usageName(code2)] : [])].join('+');
  }
  if (type === CONSUMER) return CONSUMER_NAMES.get(code1) ?? `media 0x${code1.toString(16)}`;
  if (type === SPECIAL) return code1 === 255 ? 'FN' + code2 : SPECIAL_NAMES.get(code1) ?? `special ${code1}/${code2}`;
  return `unknown ${type}/${code1}/${code2}`;
}

/**
 * Only entries we have decoded and verified may be written: plain keys, modifiers, known media keys, unassigned.
 * Special (240) entries are refused: they include FN and the Win/Mac mode switch, and a wrong one could lock the user out.
 * @param {{type: number, code1: number, code2: number}} e
 */
export function isWritableEntry({ type, code1, code2 }) {
  if (![type, code1, code2].every(v => Number.isInteger(v) && v >= 0 && v <= 255)) return false;
  if (type === 0) return code1 === 0 && code2 === 0;
  if (type === KEY) return code2 <= 0xe7;
  if (type === CONSUMER) return code2 === 0 && CONSUMER_NAMES.has(code1);
  return false;
}

/** Everything the UI offers as a remap target: [{label, entry}]. */
export function remapChoices() {
  /** @type {{label: string, entry: {type: number, code1: number, code2: number}}[]} */
  const out = [];
  for (let u = 4; u <= 82; u++) if (u !== 50) out.push({ label: usageName(u), entry: { type: KEY, code1: 0, code2: u } });
  for (const [bit] of MODS) out.push({ label: describeEntry({ type: KEY, code1: bit, code2: 0 }), entry: { type: KEY, code1: bit, code2: 0 } });
  for (const [code] of CONSUMER_NAMES) out.push({ label: describeEntry({ type: CONSUMER, code1: code, code2: 0 }), entry: { type: CONSUMER, code1: code, code2: 0 } });
  out.push({ label: '', entry: { type: 0, code1: 0, code2: 0 } });
  return out;
}
