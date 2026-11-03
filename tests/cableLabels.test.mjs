// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { LABEL_STOCKS, getStock, labelsPerSheet, cellOrigin, cellPrintRect } from '../js/labelStock.js';
import { wrapToWidth, wrapToChars } from '../js/wrapText.js';
import { isUnnumbered, codeForRun, FIELD_TOKENS } from '../js/labelFields.js';
import { renderRow, fitRow, buildCells, paginate, layoutSheets } from '../js/labelLayout.js';
import { buildSheetSvg, approximateMeasurer } from '../js/labelSheetSvg.js';

test('Label Stock Geometry', () => {
  const mr610 = getStock('MR610');
  assert.equal(mr610.grid.cols, 8);
  assert.equal(mr610.grid.rows, 4);
  assert.equal(labelsPerSheet(mr610), 32);

  const origin = cellOrigin(mr610, 0);
  assert.equal(origin.x, mr610.margins.left);
  assert.equal(origin.y, mr610.margins.top);

  const printRect = cellPrintRect(mr610, 0);
  assert.equal(printRect.height, 19.1);
  assert.equal(printRect.width, 25.4);
});

test('Text Wrapping', () => {
  const chars = wrapToChars('Hello world this is a test', 10);
  assert.ok(chars.length >= 3);
  assert.equal(chars.join(' '), 'Hello world this is a test');

  const widthWrapped = wrapToWidth('AUDIO_AMPLIFIER_CHANNEL_01_OUTPUT_MONITOR', 20, (s) => s.length);
  assert.ok(widthWrapped.length > 1);
});

test('Field Tokens and Unnumbered Check', () => {
  assert.ok(isUnnumbered('N/A'));
  assert.ok(isUnnumbered(''));
  assert.ok(isUnnumbered('000000'));
  assert.ok(!isUnnumbered('W1001'));

  const sampleRun = {
    id: 'c123',
    wireNumber: 'W1001',
    source: 'SW01',
    sourceConnector: 'P1',
    destination: 'AMP01',
    destConnector: 'IN1',
  };

  const code = codeForRun(sampleRun);
  assert.equal(code, 'APK:CBL:c123');

  const rendered = renderRow('{wireNumber}: {source}/{sourceConnector} -> {destination}', sampleRun);
  assert.equal(rendered, 'W1001: SW01/P1 -> AMP01');
});

test('Label Layout & Pagination', () => {
  const runs = [
    { id: '1', wireNumber: 'W-01', source: 'SRC-A', destination: 'DEST-B' },
    { id: '2', wireNumber: 'W-02', source: 'SRC-B', destination: 'DEST-C' },
  ];

  const config = {
    rows: ['{wireNumber}', '{source}', '{destination}'],
    forceAllCaps: true,
    bothEnds: true,
    endMarker: 'ab',
    startOffset: 0,
  };

  const cells = buildCells(runs, config);
  assert.equal(cells.length, 4); // 2 runs * 2 ends
  assert.ok(cells[0].rows[0].includes('(A)'));
  assert.ok(cells[1].rows[0].includes('(B)'));

  const stock = getStock('MR610');
  const pages = paginate(cells, stock);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].cells.length, 32);
  assert.equal(pages[0].cells[0].runId, '1');
});

test('SVG Sheet Preview Generation', () => {
  const stock = getStock('MR610');
  const runs = [
    { id: '1', wireNumber: 'CBL-001', source: 'SW01', destination: 'RACK01' },
  ];
  const pages = layoutSheets(runs, {
    rows: ['{wireNumber}', '{source}', '{destination}'],
    forceAllCaps: true,
    bothEnds: false,
    endMarker: 'none',
    startOffset: 0,
  }, stock);

  const svg = buildSheetSvg(pages[0], stock, {
    measure: approximateMeasurer,
    theme: 'dark',
    showCellNumbers: true,
  });

  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('CBL-001'));
  assert.ok(svg.includes('100 mm scale check'));
  assert.ok(svg.endsWith('</svg>'));
});
