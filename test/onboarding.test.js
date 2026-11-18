import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isConfigInterface } from '../src/transport/discovery.js';
import { models, findModel, hidFilters } from '../src/models/index.js';
import { ace75_8k } from '../src/models/ace75-8k.js';
import { layoutRows } from '../src/ui/layout.js';
import { collectReport, formatReport } from '../src/report.js';
import { mockKeyboard } from './helpers/mock-device.js';

const cfg = { usagePage: 1, usage: 0, outputReports: [{ reportId: 0 }] };

test('only the normal config interface may be opened, never the boot interface', () => {
  assert.equal(isConfigInterface({ collections: [cfg] }), true);
  assert.equal(isConfigInterface({ collections: [{ usagePage: 0xFF00, usage: 1, outputReports: [{ reportId: 0 }] }] }), false); // boot / update
  assert.equal(isConfigInterface({ collections: [cfg, { usagePage: 0xFF00, usage: 1 }] }), false); // any boot collection disqualifies
  assert.equal(isConfigInterface({ collections: [{ usagePage: 1, usage: 6, outputReports: [{ reportId: 0 }] }] }), false); // normal typing interface
  assert.equal(isConfigInterface({ collections: [{ usagePage: 1, usage: 0, outputReports: [{ reportId: 4 }] }] }), false);
  assert.equal(isConfigInterface({ collections: [{ usagePage: 1, usage: 0 }] }), false);
  assert.equal(isConfigInterface({ collections: [] }), false);
});

test('registry: lookup by USB id, unique ids, unverified models are read-only', () => {
  assert.equal(findModel(0x3837, 0x303C), ace75_8k);
  assert.equal(findModel(0x3837, 0x301D)?.name, 'Ace 75 16K');
  assert.equal(findModel(0x3837, 0x9999), undefined);
  assert.equal(new Set(models.map(m => `${m.vid}:${m.pid}`)).size, models.length);
  assert.equal(new Set(models.map(m => m.name)).size, models.length); // backups are matched by name
  assert.equal(findModel(0x3837, 0x301D)?.verified, false);
  assert.equal(ace75_8k.verified, true);
});

test('every registered model has what the app needs (layout rows resolve, limits, effects)', () => {
  for (const m of models) {
    assert.ok(layoutRows(m).length > 0, m.name);
    assert.ok(Object.keys(m.limits).length > 0 && m.keys > 0 && m.matrixKeys > 0, m.name);
    assert.ok(m.lightEffects.length > 0, m.name);
  }
});

test('the picker filter is vendor-wide so unknown keyboards can be reported', () => {
  assert.deepEqual(hidFilters(), [{ vendorId: 0x3837 }]);
});

test('report: reads the four blocks and formats them', async () => {
  const kb = mockKeyboard();
  const r = await collectReport({ ...kb, productName: 'Ace 75', vendorId: 0x3837, productId: 0x303C, collections: [{ usagePage: 1, usage: 0 }] }, ace75_8k);
  assert.equal(r.steps.length, 4);
  assert.ok(r.steps.every(s => s.hex && !s.error));
  const text = formatReport(r);
  assert.match(text, /vendor 0x3837, product 0x303C/);
  assert.match(text, /Ace 75 8K \(verified\)/);
  assert.match(text, /settings block \(cmd 5\)/);
});

test('report: a read that fails is reported, not thrown', async () => {
  const kb = mockKeyboard();
  kb.sendReport = async () => { throw new Error('usb gone'); };
  const r = await collectReport({ ...kb, productName: 'X', vendorId: 1, productId: 2, collections: [] }, ace75_8k);
  assert.equal(r.steps.length, 4);
  assert.ok(r.steps.every(s => /usb gone/.test(s.error ?? '')));
  assert.match(formatReport(r), /ERROR: usb gone/);
  assert.match(formatReport(r), /none listed/);
});

test('report for an unknown model sends nothing to the keyboard', async () => {
  const kb = mockKeyboard();
  const r = await collectReport({ ...kb, productName: 'New', vendorId: 0x3837, productId: 0x1234, collections: [{ usagePage: 1, usage: 0 }] }, null);
  assert.equal(kb.sent.length, 0);
  assert.equal(r.model, null);
  assert.match(formatReport(r), /not supported yet, nothing was read/);
});
