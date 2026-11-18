// Which USB interface of a keyboard may be opened. Only the normal keyboard-config interface qualifies.
// The boot/update interface (usagePage 0xFF00) is never opened: it can flash firmware.

/**
 * @param {{collections: readonly {usagePage?: number, usage?: number, outputReports?: readonly {reportId?: number}[]}[]}} d
 * @returns {boolean} true for the config interface: usagePage 1, usage 0, with an output report 0
 */
export const isConfigInterface = d =>
  d.collections.length > 0 &&
  d.collections.every(c => c.usagePage !== 0xFF00) &&
  d.collections.some(c => c.usagePage === 1 && c.usage === 0 && (c.outputReports ?? []).some(r => r.reportId === 0));
