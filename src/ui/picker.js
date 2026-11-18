// Groups and filters the remap choices for the key picker.
/** @param {{label: string, entry: {type: number, code1: number, code2: number}}} c */
export function groupOf({ entry: { type, code2 } }) {
  if (type === 48) return 'Media';
  if (type === 0) return 'Other';
  if (code2 === 0) return 'Modifiers';
  if (code2 >= 4 && code2 <= 29) return 'Letters';
  if (code2 >= 30 && code2 <= 39) return 'Numbers';
  if (code2 >= 58 && code2 <= 69) return 'F keys';
  return 'Other';
}

export const ORDER = ['Letters', 'Numbers', 'F keys', 'Modifiers', 'Media', 'Other'];

/** The user-facing name of a choice ('' means the key is disabled). @param {string} label */
export const choiceName = label => label || 'None (disables the key)';

/** @param {{label: string, entry: any}[]} choices @param {string} query @returns {{name: string, items: typeof choices}[]} */
export function groupChoices(choices, query = '') {
  const q = query.trim().toLowerCase();
  return ORDER.map(name => ({
    name,
    items: choices.filter(c => groupOf(c) === name && (!q || choiceName(c.label).toLowerCase().includes(q))),
  })).filter(g => g.items.length);
}
