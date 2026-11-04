// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// THE ONE TABLE (ROAD-3494): the cable runs register as APKTable
// 'cable-labels-runs', drawn by js/cableTable.js on the vendored apk-table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadApkTable, rowsOf } = require('./apk-table-shim.cjs');
const APP = new URL('..', import.meta.url).pathname;

test('the cable runs are APKTable cable-labels-runs; an edit lands in the run', async () => {
  const { window, document } = loadApkTable(APP + 'vendor/apk-table/apk-table.js');
  globalThis.APKTable = window.APKTable;
  const { cableTable } = await import('../js/cableTable.js');
  const runs = [{ wireNumber: 'C-001', source: 'Rack A', destination: '<i>Stage</i>' }];
  const edits = [];
  const t = cableTable(document.createElement('div'), runs, { onEdit: (i, k, v) => edits.push([i, k, v]) });
  assert.equal(window.APKTable.get('cable-labels-runs'), t);
  assert.deepEqual(rowsOf(t)[0].slice(0, 5), ['1', 'C-001', 'Rack A', '', '<i>Stage</i>']);
  const td = t.el.querySelector('tbody').children[0].children[2];
  td.textContent = 'Rack B';
  td.blur();
  assert.equal(runs[0].source, 'Rack B');
  assert.deepEqual(edits, [[0, 'source', 'Rack B']]);
  delete globalThis.APKTable;
});

test('index.html loads the vendored table and draws no <table> itself', () => {
  const html = fs.readFileSync(APP + 'index.html', 'utf8');
  assert.match(html, /vendor\/apk-table\/apk-table\.js/);
  assert.doesNotMatch(html, /<table|createElement\(['"]table/);
});
