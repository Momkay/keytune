// A plain-text report someone can paste into an issue to help add or check a keyboard model.
// Contains USB ids, the firmware string and a few bytes of settings; nothing personal. Reads only.
import { CMD, readBlock } from './transport/device.js';

const hex = (/** @type {number[]} */ a) => a.map(b => b.toString(16).padStart(2, '0')).join(' ');
const h4 = (/** @type {number} */ n) => '0x' + n.toString(16).toUpperCase().padStart(4, '0');

/**
 * @param {any} dev a HIDDevice
 * @param {any} model the registry entry, or null for a keyboard the app does not know (then nothing is read)
 */
export async function collectReport(dev, model) {
  /** @type {{label: string, hex?: string, text?: string, error?: string}[]} */
  const steps = [];
  if (model) {
    /** @type {[string, number, number, number][]} */
    const reads = [['firmware info (cmd 3)', CMD.INFO, 0, 56], ['settings block (cmd 5)', CMD.FUNC_GET, 0, 64], ['key trigger table, first 8 rows (cmd 0xA0)', CMD.KEY_GET, 0, 64], ['key matrix layer 0, first 32 keys (cmd 8)', CMD.MATRIX, 0, 96]];
    for (const [label, cmd, offset, size] of reads) {
      try {
        const bytes = await readBlock(dev, cmd, offset, size);
        steps.push({ label, hex: hex(bytes), text: cmd === CMD.INFO ? bytes.map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('') : undefined });
      } catch (e) { steps.push({ label, error: e instanceof Error ? e.message : String(e) }); }
    }
  }
  return {
    device: { name: dev.productName, vendorId: dev.vendorId, productId: dev.productId, collections: (dev.collections ?? []).map((/** @type {any} */ c) => ({ usagePage: c.usagePage, usage: c.usage })) },
    model: model ? { name: model.name, verified: model.verified } : null,
    steps,
  };
}

/** @param {Awaited<ReturnType<typeof collectReport>>} r */
export function formatReport(r) {
  const lines = ['Keytune device report', `Device: ${r.device.name} (vendor ${h4(r.device.vendorId)}, product ${h4(r.device.productId)})`,
    `HID interfaces: ${r.device.collections.map((/** @type {{usagePage: number, usage: number}} */ c) => `usagePage ${c.usagePage} usage ${c.usage}`).join('; ') || 'none listed'}`,
    r.model ? `Model in the app: ${r.model.name} (${r.model.verified ? 'verified' : 'not verified, read-only'})` : 'Model in the app: none (this keyboard is not supported yet, nothing was read)'];
  for (const s of r.steps) {
    lines.push('', s.label + ':');
    if (s.error) lines.push('  ERROR: ' + s.error);
    else { lines.push('  ' + s.hex); if (s.text) lines.push('  text: ' + s.text); }
  }
  return lines.join('\n');
}
