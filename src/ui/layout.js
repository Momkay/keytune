// Turns a model's compact layout into keys with positions, for drawing the keyboard.
const LABELS = new Map([['Bksp', 'Backspace'], ['Delete', 'Del'], ['LShift', 'Shift'], ['RShift', 'Shift'], ['LCtrl', 'Ctrl'], ['RCtrl', 'Ctrl'], ['LAlt', 'Alt'],
  ['FN1', 'Fn'], ['Caps', 'Caps'], ['Up', '↑'], ['Down', '↓'], ['Left', '←'], ['Right', '→'], ['~', '` ~'],
  ['1', '1 !'], ['2', '2 @'], ['3', '3 #'], ['4', '4 $'], ['5', '5 %'], ['6', '6 ^'], ['7', '7 &'], ['8', '8 *'], ['9', '9 ('], ['0', '0 )'], ['-', '- _'], ['=', '= +'],
  ['[', '[ {'], [']', '] }'], ['\\', '\\ |'], [';', '; :'], ["'", "' \""], [',', ', <'], ['.', '. >'], ['/', '/ ?']]);

const SPOKEN = new Map([['Bksp', 'Backspace'], ['LShift', 'Left Shift'], ['RShift', 'Right Shift'], ['LCtrl', 'Left Ctrl'], ['RCtrl', 'Right Ctrl'], ['LAlt', 'Left Alt'],
  ['FN1', 'Fn'], ['Caps', 'Caps Lock'], ['~', 'Backtick'], ['\\', 'Backslash'], ['PgUp', 'Page Up'], ['PgDn', 'Page Down'], ['Up', 'Up arrow'], ['Down', 'Down arrow'],
  ['Left', 'Left arrow'], ['Right', 'Right arrow'], ['-', 'Minus'], ['=', 'Equals'], ['[', 'Left bracket'], [']', 'Right bracket'], [';', 'Semicolon'], ["'", 'Quote'],
  [',', 'Comma'], ['.', 'Period'], ['/', 'Slash'], ['RT', 'RT key']]);

/** What a screen reader should say for a key name. @param {string} name */
export const spokenName = name => SPOKEN.get(name) ?? name;

/** Friendly keycap text for a key name. @param {string} name */
export const keyLabel = name => LABELS.get(name) ?? name;

/**
 * @param {{layout: (string | number | [string, number])[][], keymap: [number, string][]}} model
 * @returns {{name?: string, row?: number, w: number, label?: string, kind?: 'logo', cx: number, cy: number}[][]}
 *   one array per keyboard row; gaps have no name. cx and cy are the centre of each item as a fraction (0..1) of the board,
 *   used to place the light preview. The item "@logo" is the logo key (the Ace 75 has one at the right end of the shift row).
 */
export function layoutRows(model) {
  const rowOf = new Map(model.keymap.map(([row, name]) => [name, row]));
  const rows = model.layout.length;
  return model.layout.map((items, r) => {
    let x = 0;
    return items.map(item => {
      const [name, w] = typeof item === 'number' ? ['', item] : typeof item === 'string' ? [item, 1] : item;
      const at = { cx: (x + w / 2) / 16, cy: (r + 0.5) / rows };
      x += w;
      if (name === '') return { w, ...at };
      if (name === '@logo') return { w, kind: /** @type {const} */ ('logo'), ...at };
      const row = rowOf.get(name);
      if (row === undefined) throw new Error(`layout key ${name} is not in the key map`);
      return { name, row, w, label: keyLabel(name), ...at };
    });
  });
}
