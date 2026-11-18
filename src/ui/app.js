// The page: connection, one-screen workspace (rail, keyboard, inspector). All keyboard work is in session.js.
import { h, fill } from './dom.js';
import { icon, logo } from './icons.js';
import { findModel, hidFilters } from '../models/index.js';
import { createSession } from '../session.js';
import { collectReport, formatReport } from '../report.js';
import { isConfigInterface } from '../transport/discovery.js';
import { buildKeyboard } from './keyboard.js';
import { createPreview } from './preview.js';
import { createToaster, saveFile } from './toast.js';
import { sensPanel } from './panel-sens.js';
import { remapPanel, capText } from './panel-remap.js';
import { settingsPanel } from './panel-settings.js';
import { lightPanel } from './panel-light.js';
import { effectiveKey, emptyPending, isEmpty, summary, stageColors } from './pending.js';
import { funcUiFromBlock } from '../codecs/func.js';
import { keyLabel } from './layout.js';
import { isWritableEntry, describeEntry } from '../codecs/matrix.js';

/** The connected keyboard's registry entry and session; null until one is connected. @type {any} */
let model = null;
/** @type {ReturnType<typeof createSession> | null} */
let session = null;
/** @type {ReturnType<typeof buildKeyboard> | null} */
let kb = null;
/** @type {ReturnType<typeof createPreview> | null} */
let preview = null;
/** @type {Map<number, string>} */
let nameOf = new Map();
const supported = 'hid' in navigator;

const SECTIONS = [
  ['sens', 'Sensitivity', 'trigger', 'How far a key travels before it counts'],
  ['remap', 'Remap', 'keys', 'What each key sends'],
  ['light', 'Lighting', 'light', 'Backlight, logo and ambient light'],
  ['settings', 'Settings', 'sliders', 'Speed, typing and power'],
];

const toastEl = h('div', { class: 'toast', hidden: true });
const toast = createToaster(toastEl);
const boardWrap = h('div', { class: 'board-wrap' });
const caption = h('p', { class: 'caption' });
const panelEl = h('div', { class: 'panel', role: 'tabpanel', id: 'panel', tabIndex: -1 });
const footText = h('span', { class: 'foot-text' }, 'No changes');
const applyBtn = h('button', { type: 'button', class: 'btn primary', disabled: true, onclick: () => applyAll() }, icon('check', 16), 'Apply');
const discardBtn = h('button', { type: 'button', class: 'btn ghost', disabled: true, onclick: () => { if (session) session.pending = emptyPending(); ctx.changed(); ctx.rebuildPanel(); } }, icon('undo', 16), 'Discard');
const foot = h('div', { class: 'inspector-foot' }, footText, discardBtn, applyBtn);

/** Shared with the panels. */
const ctx = {
  get model() { return model; }, mode: 'sens', layer: 0, lightGroup: 'main', brush: { r: 255, g: 0, b: 0 }, sel: /** @type {Set<number>} */ (new Set()),
  get pending() { return /** @type {any} */ (session).pending; }, get cur() { return /** @type {any} */ (session).cur; }, get func() { return /** @type {any} */ (session).func; },
  matrix: (/** @type {number} */ l) => session?.mat.get(l),
  /** Stage a colour for some keys (Custom colors effect). */
  paintKeys(/** @type {number[]} */ rows, /** @type {{r: number, g: number, b: number}} */ c) { if (!session) return; stageColors(session.pending, session.colors, rows, c); ctx.changed(); },
  changed() {
    paint();
    const n = !!session && !isEmpty(session.pending);
    footText.textContent = n && session ? summary(session.pending) : 'No changes';
    footText.classList.toggle('has', n);
    applyBtn.disabled = discardBtn.disabled = !n;
    updateCaption();
    preview?.refresh();
  },
  rebuildPanel() {
    // keep keyboard focus on "the same" control when the panel is redrawn (a click on an option rebuilds it)
    const stops = () => [...panelEl.querySelectorAll('button, input, summary')];
    const was = panelEl.contains(document.activeElement) ? stops().indexOf(/** @type {any} */ (document.activeElement)) : -1;
    fill(panelEl, ctx.mode === 'sens' ? sensPanel(ctx) : ctx.mode === 'remap' ? remapPanel(ctx) : ctx.mode === 'light' ? lightPanel(ctx) : settingsPanel(ctx));
    if (was >= 0) /** @type {any} */ (stops()[was])?.focus();
    paint();
    updateCaption();
    preview?.refresh();
  },
  selectAll() { ctx.sel = new Set(model.keymap.map((/** @type {[number, string]} */ [r]) => r)); ctx.rebuildPanel(); },
  clearSelection() { ctx.sel = new Set(); ctx.rebuildPanel(); },
  async setLayer(/** @type {number} */ l) { ctx.layer = l; await showLayer(); },
};

/** Staged lighting if there is any, else what the keyboard has: what the preview shows. */
function lightState() {
  const ui = session ? (session.pending.func ?? funcUiFromBlock(session.func)) : null;
  if (!ui || !session) return null;
  const colors = session.colors.map((c, row) => session?.pending.colors.get(row) ?? c);
  return { light: ui.light, sides: ui.sides, colors };
}

function updateCaption() {
  const st = lightState();
  if (!st || !model) return;
  const fx = model.lightEffects.find((/** @type {{id: number}} */ e) => e.id === st.light.effect);
  fill(caption, icon('sparkle', 14), h('span', {}, `Live preview of the backlight: ${fx ? fx.name : 'unknown effect'}. An approximation, the real keyboard may differ a little.`));
}

function paint() {
  if (!kb || !session) return;
  const s = session;
  kb.paint(row => {
    const selected = ctx.sel.has(row), name = /** @type {string} */ (nameOf.get(row));
    if (ctx.mode === 'remap') {
      const m = s.mat.get(ctx.layer);
      if (!m) return { main: keyLabel(name), selected };
      const staged = s.pending.remap.get(`${ctx.layer}:${row}`);
      const shown = staged ? (staged.to === 'factory' ? m.factory[row] : staged.to) : m.live[row];
      const locked = !isWritableEntry(m.live[row]) && describeEntry(m.live[row]) !== '';
      return { main: capText(shown), desc: `sends ${capText(shown) === '-' ? 'nothing' : capText(shown)}${staged ? ', changed' : ''}${locked ? ', locked' : ''}`, selected, changed: !!staged, locked };
    }
    if (ctx.mode === 'light' && lightState()?.light.effect === 0) { const staged = s.pending.colors.has(row); return { main: keyLabel(name), desc: staged ? 'painted, not saved yet' : 'click to paint', changed: staged }; }
    const k = effectiveKey(s.pending, s.cur, row);
    const mm = (k.actuation / 100).toFixed(2);
    return { main: keyLabel(name), sub: mm + (k.keyMode ? ' RT' : ''), desc: `press point ${mm} millimetres${k.keyMode ? ', Rapid Trigger on' : ''}${s.pending.keys.has(row) ? ', changed' : ''}`, selected, changed: s.pending.keys.has(row) };
  });
}

async function showLayer() {
  if (!session) return;
  const s = session;
  if (!s.mat.get(ctx.layer)) { toast.show('Reading this layer from the keyboard...'); fill(panelEl, h('div', { class: 'empty' }, h('p', {}, 'Reading this layer...'))); await guard(() => s.loadLayer(ctx.layer)); toast.hide(); }
  ctx.rebuildPanel();
}

/** @param {number} row @param {MouseEvent} e */
function pickKey(row, e) {
  if (ctx.mode === 'light' && ctx.lightGroup === 'main' && lightState()?.light.effect === 0) { ctx.paintKeys([row], ctx.brush); return; }
  const multi = ctx.mode === 'sens' && (e.ctrlKey || e.shiftKey || e.metaKey);
  if (multi) { ctx.sel.has(row) ? ctx.sel.delete(row) : ctx.sel.add(row); }
  else ctx.sel = ctx.sel.size === 1 && ctx.sel.has(row) ? new Set() : new Set([row]);
  ctx.rebuildPanel();
}

/** Run a keyboard task; any failure is shown in plain words. @param {() => Promise<any>} fn */
async function guard(fn) {
  try { return await fn(); } catch (e) { toast.show(`Something went wrong: ${e instanceof Error ? e.message : e}`, 'error'); return undefined; }
}

async function applyAll() {
  if (!session) return;
  const s = session;
  applyBtn.disabled = discardBtn.disabled = true;
  const r = await guard(() => s.apply(m => toast.show(m)));
  if (ctx.mode === 'remap') await showLayer(); else ctx.rebuildPanel(); // refresh first: showLayer shows and hides its own "reading" message
  ctx.changed();
  if (r) toast.show(r.problems.length ? `Not everything saved correctly: ${r.problems.join(', ')}. Your backup is in your Downloads folder; use Restore to put things back.` : 'Saved. Everything was checked by reading it back from the keyboard.', r.problems.length ? 'error' : 'ok');
}

async function restore(/** @type {File} */ file) {
  if (!session) return;
  const s = session;
  const r = await guard(async () => s.stageBackup(JSON.parse(await file.text())));
  if (!r) return;
  ctx.changed(); ctx.rebuildPanel();
  const total = r.keys + r.remap + r.settings;
  toast.show(total ? `Backup loaded: ${total} change${total > 1 ? 's' : ''} ready to review. Press Apply to put them on the keyboard.${r.skipped ? ` ${r.skipped} special key${r.skipped > 1 ? 's were' : ' was'} left alone.` : ''}` : 'That backup matches your keyboard already. Nothing to change.', total ? 'info' : 'ok');
}

/** Put a text report on the clipboard so it can be pasted into an issue. @param {any} dev @param {any} m */
async function copyReport(dev, m) {
  const text = formatReport(await collectReport(dev, m));
  try { await navigator.clipboard.writeText(text); toast.show('Report copied. Paste it where you were asked to share it.', 'ok'); }
  catch { toast.show('Could not copy automatically. Your browser blocked the clipboard.', 'error'); }
}

// ---- workspace ----
const navEls = SECTIONS.map(([id, label, ic]) => h('button', { type: 'button', role: 'tab', class: 'nav', 'aria-selected': id === 'sens', 'aria-controls': 'panel', tabIndex: id === 'sens' ? 0 : -1, title: label, onclick: () => setMode(id) }, icon(ic, 22), h('span', {}, label)));
const inspTitle = h('h2', { class: 'insp-title' });
const inspSub = h('p', { class: 'insp-sub' });

async function setMode(/** @type {string} */ id) {
  ctx.mode = id;
  if (id === 'remap' && ctx.sel.size > 1) ctx.sel = new Set([[...ctx.sel][0]]);
  SECTIONS.forEach(([t], i) => { navEls[i].setAttribute('aria-selected', String(t === id)); navEls[i].tabIndex = t === id ? 0 : -1; });
  const [, label, , sub] = /** @type {string[]} */ (SECTIONS.find(([t]) => t === id));
  inspTitle.textContent = label; inspSub.textContent = sub;
  workspace.dataset.mode = id;
  kb?.setLightMode(id === 'light');
  if (id === 'remap') await showLayer(); else ctx.rebuildPanel();
}

/** Arrow keys, Home and End move between the sections and open the one they land on. @param {KeyboardEvent} e */
function navKeys(e) {
  const i = navEls.indexOf(/** @type {any} */ (document.activeElement));
  if (i < 0) return;
  const n = navEls.length;
  const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
  if (next < 0 || navEls[next].disabled) return;
  e.preventDefault(); navEls[next].focus(); navEls[next].click();
}

const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Choose a backup file', onchange: (/** @type {any} */ e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restore(f); } });
const restoreBtn = h('button', { type: 'button', class: 'nav tool', title: 'Restore a backup file', onclick: () => fileInput.click() }, icon('upload', 20), h('span', {}, 'Restore'));
const backupBtn = h('button', { type: 'button', class: 'nav tool', title: 'Save a backup file', onclick: async () => { if (session && await guard(() => /** @type {any} */ (session).backup())) toast.show('Backup saved to your Downloads folder.', 'ok'); } }, icon('download', 20), h('span', {}, 'Backup'));
const rail = h('nav', { class: 'rail', 'aria-label': 'Sections' },
  h('div', { class: 'mark', title: 'Keytune' }, logo(26)),
  h('div', { class: 'nav-group', role: 'tablist', 'aria-label': 'What to change', onkeydown: navKeys }, navEls),
  h('div', { class: 'nav-group tools' }, backupBtn, restoreBtn));

const chip = h('span', { class: 'chip-status' }, h('i', { class: 'dot' }), 'Not connected');
const brandModel = h('span', {}, '');
const profileBar = h('div', { class: 'segmented profiles', role: 'group', 'aria-label': 'Keyboard profile' });
const profileNote = h('div', { class: 'readonly', hidden: true, role: 'note' });
const readonlyBar = h('div', { class: 'readonly', hidden: true, role: 'note' });
const stageHead = h('header', { class: 'stage-head' },
  h('h1', { class: 'brand' }, h('span', { class: 'brand-name' }, 'Keytune'), brandModel),
  h('div', { class: 'head-right' }, profileBar, chip));
const stage = h('section', { class: 'stage' }, stageHead, readonlyBar, profileNote, boardWrap, caption);
const inspector = h('aside', { class: 'inspector', 'aria-label': 'Settings for the chosen section' },
  h('header', { class: 'insp-head' }, inspTitle, inspSub), panelEl, foot);
const workspace = h('main', { class: 'workspace', hidden: true }, rail, stage, inspector);
const welcome = h('main', { class: 'welcome' });

/** @param {string} note @param {boolean} [busy] @param {any} [extra] more card content, e.g. an unsupported-keyboard notice */
function showWelcome(note = '', busy = false, extra = null) {
  workspace.hidden = true; welcome.hidden = false; preview?.stop();
  chip.lastChild.textContent = busy ? 'Connecting...' : 'Not connected';
  fill(welcome, h('div', { class: 'card' },
    h('div', { class: 'card-mark' }, logo(28)),
    h('h1', { class: 'welcome-title' }, 'Set up your keyboard'),
    h('p', { class: 'lead' }, 'Change how your keys feel, remap them and tune the lighting. It runs in your browser and nothing is uploaded.'),
    h('ol', { class: 'steps' }, h('li', {}, 'Plug your keyboard in with the USB cable.'), h('li', {}, 'Close the official MCHOSE app or website if it is open.'), h('li', {}, 'Press Connect and pick your keyboard in the window that appears.')),
    h('button', { type: 'button', class: 'btn primary big', disabled: busy || !supported, onclick: () => connect() }, icon('plug', 18), busy ? 'Reading your keyboard...' : 'Connect keyboard'),
    !supported && h('p', { class: 'note' }, 'This browser cannot talk to keyboards. Please open this page in Chrome or Edge on a computer.'),
    note && h('p', { class: 'note', role: 'alert' }, note),
    extra,
    h('p', { class: 'fine' }, 'For desktop Chrome or Edge only: a keyboard is configured from a computer, so there is no tablet or phone layout.'),
    h('p', { class: 'fine' }, 'Unofficial community tool, not affiliated with MCHOSE. It changes the memory inside your keyboard, so it saves a backup file to your Downloads folder before the first change. Use at your own risk.')));
}

/** A keyboard this app has no profile for: nothing is read or written, but the ids can be shared. @param {HIDDevice} dev */
function showUnsupported(dev) {
  const id = `${dev.productName || 'MCHOSE keyboard'} (vendor 0x${dev.vendorId.toString(16)}, product 0x${dev.productId.toString(16)})`;
  showWelcome('', false, h('div', { class: 'unsupported', role: 'alert' },
    h('p', {}, `${id} is not supported yet, so nothing was read or changed.`),
    h('p', { class: 'hint' }, 'You can help add it: copy this report and share it (see docs/ADDING_A_MODEL.md).'),
    h('button', { type: 'button', class: 'btn', onclick: () => guard(() => copyReport(dev, null)) }, icon('copy', 16), 'Copy report')));
}

/** One button per onboard profile; a dot marks the one the keyboard is using. Only profile 1 can be edited. */
function drawProfiles() {
  const s = /** @type {any} */ (session);
  fill(profileBar, ...Array.from({ length: s.model.profiles }, (_, p) => h('button', {
    type: 'button', class: p === s.profile ? 'seg on' : 'seg', 'aria-pressed': p === s.profile,
    title: p === s.active ? 'The keyboard is using this profile' : p ? 'View only' : '',
    onclick: () => guard(async () => { await s.showProfile(p); await afterProfile(); }),
  }, `Profile ${p + 1}`, p === s.active && ' •')));
}

/** Redraw after another profile was read; other profiles are view-only. */
async function afterProfile() {
  const s = /** @type {any} */ (session), locked = !s.model.verified || s.profile !== 0;
  panelEl.inert = locked; panelEl.classList.toggle('inert', locked); restoreBtn.disabled = locked;
  ctx.sel = new Set();
  const using = `Profile ${s.active + 1}`;
  profileNote.hidden = s.profile === 0 && s.active === 0;
  fill(profileNote, icon('alert', 16), h('span', {}, s.profile ? `You are looking at Profile ${s.profile + 1}. It can only be viewed here.${s.profile === s.active ? '' : ` The keyboard is using ${using}.`}` : `The keyboard is using ${using}, so changes made here will not show on the keys until you switch to Profile 1.`),
    s.profile !== s.active && h('button', { type: 'button', class: 'btn', onclick: () => guard(async () => { const r = await s.activate(); toast.show(r.problems.length ? 'The keyboard did not switch profile correctly. Your backup is in your Downloads folder.' : `The keyboard now uses Profile ${s.profile + 1}. Checked by reading it back.`, r.problems.length ? 'error' : 'ok'); await afterProfile(); }) }, `Use Profile ${s.profile + 1}`));
  drawProfiles(); await setMode(ctx.mode); ctx.changed();
}

/** @param {HIDDevice} dev @param {any} m */
async function useDevice(dev, m) {
  showWelcome('', true);
  model = m; session = createSession(m, saveFile);
  nameOf = new Map(m.keymap);
  kb = buildKeyboard(m, (row, e) => pickKey(row, e), () => { ctx.lightGroup = 'logo'; setMode('light'); });
  fill(boardWrap, kb.el);
  preview = createPreview({ kb, model: m, getState: () => lightState() ?? { colors: [], light: { effect: 255, brightness: 0, speed: 1, ownColor: false, color: { r: 0, g: 0, b: 0 } }, sides: { logo: { effect: 0, brightness: 0, speed: 1, ownColor: false, color: { r: 0, g: 0, b: 0 } }, ambient: { effect: 0, brightness: 0, speed: 1, ownColor: false, color: { r: 0, g: 0, b: 0 } } } } });
  ctx.sel = new Set(); ctx.layer = 0;
  if (!dev.opened) await dev.open();
  session.dev = dev;
  await session.load();
  welcome.hidden = true; workspace.hidden = false;
  brandModel.textContent = m.name;
  chip.classList.add('on'); chip.lastChild.textContent = `${m.name} connected`;
  // an unverified model can be looked at but never written: the controls are switched off and the write gate refuses anyway
  panelEl.inert = !m.verified; panelEl.classList.toggle('inert', !m.verified); restoreBtn.disabled = !m.verified;
  readonlyBar.hidden = m.verified;
  fill(readonlyBar, icon('alert', 16), h('span', {}, `${m.name} has not been checked on real hardware yet, so changes are switched off. You can look around and save a backup.`),
    h('button', { type: 'button', class: 'btn', onclick: () => guard(() => copyReport(dev, m)) }, icon('copy', 16), 'Copy report'));
  drawProfiles(); await afterProfile();
  preview.start();
}

async function connect() {
  try {
    const dev = (await navigator.hid.requestDevice({ filters: hidFilters() })).find(isConfigInterface);
    if (!dev) return showWelcome('Keyboard not found. In the window, choose your keyboard entries (select all of them).');
    const m = findModel(dev.vendorId, dev.productId);
    if (!m) return showUnsupported(dev);
    await useDevice(dev, m);
  } catch (e) { showWelcome(`Could not connect: ${e instanceof Error ? e.message : e}`); }
}

showWelcome();
if (supported) {
  navigator.hid.addEventListener('disconnect', e => { if (session && e.device === session.dev) { session.dev = null; chip.classList.remove('on'); showWelcome('The keyboard was unplugged. Plug it back in and press Connect.'); } });
  navigator.hid.getDevices().then(async list => {
    const d = list.find(x => isConfigInterface(x) && findModel(x.vendorId, x.productId));
    if (d) await useDevice(d, findModel(d.vendorId, d.productId));
  }).catch(e => showWelcome(`Could not reconnect: ${e.message}`));
}
document.addEventListener('visibilitychange', () => { if (document.hidden) preview?.stop(); else if (!workspace.hidden) preview?.start(); });
window.addEventListener('beforeunload', e => { if (session && !isEmpty(session.pending)) e.preventDefault(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement) && ctx.sel.size) ctx.clearSelection(); });

document.getElementById('app')?.append(welcome, workspace, toastEl, fileInput, ...toast.regions);
