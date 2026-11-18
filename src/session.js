// Everything the UI needs from a connected keyboard: load, back up, stage a backup file, apply staged changes.
// No DOM in here. Every write goes through the gated functions in write.js.
import { CMD, readBlock } from './transport/device.js';
import { COLOR_AREA, decodeColors } from './codecs/colors.js';
import { decodeKey } from './codecs/key.js';
import { decodeFunc, encodeFunc, funcUiFromBlock } from './codecs/func.js';
import { decodeMatrix, isWritableEntry, MATRIX_STRIDE, LAYERS } from './codecs/matrix.js';
import { createWriteGate } from './safety/gate.js';
import { validateBackup } from './safety/backup.js';
import { writeKeys, writeFunc, writeMatrixKey, writeActiveProfile, writeColors } from './write.js';
import { emptyPending, isEmpty, stageKeys, stageRemap, stageFunc, stageColors } from './ui/pending.js';

/**
 * @param {any} model
 * @param {(filename: string, text: string) => void} saveFile hands the backup to the user (a download in the browser)
 */
export function createSession(model, saveFile) {
  const fields = Object.keys(model.limits);
  const s = {
    model, gate: createWriteGate(),
    /** @type {any} */ dev: null,
    /** @type {any[]} */ cur: [],
    /** @type {number[]} */ func: [],
    /** @type {{r: number, g: number, b: number}[]} stored per-key colours of the shown profile */ colors: [],
    /** @type {Map<number, {live: any[], factory: any[]}>} */ mat: new Map(),
    pending: emptyPending(),

    /** Profile being shown (0..2) and the one the keyboard is using. Only profile 0 can be written; the others are view-only. */
    profile: 0, active: 0,

    /** Read the key table and settings block of the shown profile, and which profile the keyboard uses. */
    async load() {
      s.active = (await readBlock(s.dev, CMD.BASE_GET, 0, 8))[0];
      s.func = await readBlock(s.dev, CMD.FUNC_GET, 64 * s.profile, 64);
      const raw = await readBlock(s.dev, CMD.KEY_GET, 1024 * s.profile, 1024);
      s.cur = Array.from({ length: model.keys }, (_, i) => decodeKey(raw.slice(i * 8, i * 8 + 8)));
      s.colors = decodeColors(await readBlock(s.dev, CMD.LIGHT_GET, COLOR_AREA * s.profile, COLOR_AREA), model.keys);
      s.mat.clear();
    },


    /** Show another profile's settings and keys. Refuses while changes are staged. @param {number} p */
    async showProfile(p) {
      if (!Number.isInteger(p) || p < 0 || p >= model.profiles) throw new Error(`profile must be 0-${model.profiles - 1}`);
      if (!isEmpty(s.pending)) throw new Error('Apply or discard your changes before switching profile.');
      s.profile = p; await s.load();
    },

    /**
     * Tell the keyboard to use the shown profile (backup first, then write and read back).
     * @returns {Promise<{problems: string[]}>}
     */
    async activate() {
      if (!isEmpty(s.pending)) throw new Error('Apply or discard your changes before switching profile.');
      if (!s.gate.backedUp) await s.backup();
      const r = await writeActiveProfile(s.dev, model, s.gate, s.profile);
      await s.load();
      return { problems: r.bad.length ? ['active profile'] : [] };
    },

    /** Live and factory key assignments of one layer, read once and cached. @param {number} layer */
    async loadLayer(layer) {
      let m = s.mat.get(layer);
      if (!m) {
        const at = MATRIX_STRIDE * layer, n = model.matrixKeys;
        const live = decodeMatrix(await readBlock(s.dev, CMD.MATRIX, at, 3 * n), n);
        const factory = decodeMatrix(await readBlock(s.dev, CMD.MATRIX_DEFAULT, at, 3 * n), n);
        m = { live, factory };
        s.mat.set(layer, m);
      }
      return m;
    },

    /** Fresh backup of everything the app understands, given to the user as a file; unlocks writing. */
    async backup() {
      const info = await readBlock(s.dev, CMD.INFO, 0, 56);
      const func = await readBlock(s.dev, CMD.FUNC_GET, 0, 64);
      const keysHex = await readBlock(s.dev, CMD.KEY_GET, 0, 1024);
      /** @type {number[][]} */
      const matrixHex = [];
      for (let l = 0; l < LAYERS; l++) matrixHex.push(await readBlock(s.dev, CMD.MATRIX, MATRIX_STRIDE * l, 3 * model.matrixKeys)); // one request at a time
      const colorsHex = await readBlock(s.dev, CMD.LIGHT_GET, 0, COLOR_AREA);
      const snap = { device: model.name, profile: 0, readAt: new Date().toISOString(), infoHex: info, funcHex: func, keysHex, matrixHex, colorsHex, funcDecoded: decodeFunc(func) };
      saveFile(`keytune-backup-${Date.now()}.json`, JSON.stringify(snap));
      s.gate.markBackedUp();
      return snap;
    },

    /** Turn a backup file into staged changes; nothing is written until apply(). @param {any} json */
    async stageBackup(json) {
      const b = validateBackup(json, model);
      let skipped = 0;
      for (const [row] of model.keymap) {
        const k = /** @type {any} */ (b.keys[row]);
        stageKeys(s.pending, s.cur, [row], Object.fromEntries(fields.map(f => [f, k[f]])));
      }
      if (b.func) stageFunc(s.pending, s.func, funcUiFromBlock(b.func));
      if (b.colors) for (const [row] of model.keymap) stageColors(s.pending, s.colors, [row], b.colors[row]);
      if (b.matrix) {
        for (let l = 0; l < LAYERS; l++) {
          const live = (await s.loadLayer(l)).live, want = decodeMatrix(b.matrix[l], model.matrixKeys);
          for (const [row] of model.keymap) {
            const same = ['type', 'code1', 'code2'].every(f => /** @type {any} */ (live[row])[f] === /** @type {any} */ (want[row])[f]);
            if (same) continue;
            if (isWritableEntry(want[row]) && isWritableEntry(live[row])) stageRemap(s.pending, l, row, want[row]); else skipped++;
          }
        }
      }
      return { keys: s.pending.keys.size, remap: s.pending.remap.size, settings: s.pending.func ? 1 : 0, colors: s.pending.colors.size, skipped };
    },

    /**
     * Write everything staged: backup first (once per session), then keys, settings, remaps; each is read back.
     * @param {(msg: string) => void} [progress]
     * @returns {Promise<{problems: string[]}>} problems are read-back mismatches; empty means everything was confirmed
     */
    async apply(progress = () => {}) {
      if (s.profile !== 0) throw new Error('Only profile 1 can be changed; the other profiles are view-only.');
      const p = s.pending, problems = [];
      if (!s.gate.backedUp) { progress('Saving a backup first...'); await s.backup(); }
      if (p.keys.size) {
        const want = new Map([...p.keys].map(([row, patch]) => [row, { ...s.cur[row], ...patch }]));
        const r = await writeKeys(s.dev, model, s.gate, want, progress);
        if (r.bad.length) problems.push(`key sensitivity (keys ${r.bad.join(', ')})`);
      }
      if (p.colors.size) { // before the settings, so the table is in place when the effect is switched to "custom colors"
        const r = await writeColors(s.dev, model, s.gate, p.colors, progress);
        if (r.bad.length) problems.push(`key colours (keys ${r.bad.join(', ')})`);
      }
      if (p.func) {
        progress('Writing keyboard settings...');
        const r = await writeFunc(s.dev, model, s.gate, encodeFunc(s.func, p.func), p.func.deb);
        if (r.bad.length) problems.push('keyboard settings');
      }
      for (const { layer, row, to } of p.remap.values()) {
        progress('Writing key remap...');
        const entry = to === 'factory' ? (await s.loadLayer(layer)).factory[row] : to;
        const r = await writeMatrixKey(s.dev, model, s.gate, { layer, key: row, entry });
        if (r.bad.length) problems.push(`remap (layer ${layer}, key row ${row})`);
      }
      s.pending = emptyPending();
      await s.load();
      return { problems };
    },
  };
  return s;
}
