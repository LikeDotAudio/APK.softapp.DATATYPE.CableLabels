import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCableLabel, formatAverySheetHtml } from '../js/labels.js';

test('CableLabels formats labels and renders Avery sheet HTML', () => {
  const cable = { wireNumber: 'W-01', srcDevice: 'DEV-A', srcPort: 'OUT', dstDevice: 'DEV-B', dstPort: 'IN', signalType: 'AES3' };
  const label = generateCableLabel(cable);

  assert.equal(label.wireNumber, 'W-01');
  assert.equal(label.line1, 'DEV-A:OUT');
  assert.equal(label.line2, 'DEV-B:IN');

  const html = formatAverySheetHtml([label]);
  assert.match(html, /W-01/);
  assert.match(html, /FROM: DEV-A:OUT/);
  assert.match(html, /TO:   DEV-B:IN/);
});
