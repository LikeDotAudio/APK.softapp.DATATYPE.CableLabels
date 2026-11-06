// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ROAD-3583: the cables' .ifc twin (js/cableIfc.js) — written byte-deterministically, read back to the same
// runs, saved beside the cable_labels .json by the shared Save Model. With APK_IFC_PYTHON=<python with
// ifcopenshell + ifctester> the files are held to IfcOpenShell (0 schema + EXPRESS statements) and the BIM
// oracle (every APK_ set declared, every link SOURCE -> SINK); IFC_OUT=<dir> also writes them there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { parseStep } from '../vendor/apk-contracts/apk-ifc.js';
import { cablesToIfc, cablesFromIfc } from '../js/cableIfc.js';
import { toBlock, fromBlock, blockMeta, runFromThing } from '../js/cableHost.js';
import { buildBundle, BUNDLE } from '../scripts/vendor-ifc.mjs';

const require = createRequire(import.meta.url);
const { world } = require('./host-world.cjs');

/** The wizard's own sample runs (cableWizardApp.js loadSampleRuns) plus the edge cases. */
export function fixtureRuns() {
  return [
    { id: 'cbl_001', wireNumber: 'A10101', source: 'SW-NET-01', sourceConnector: 'P01', destination: 'DSP-CORE-01', destConnector: 'LAN1', wireType: 'CAT6A', sourceRoom: 'MDF', destinationRoom: 'MDF', color: 'BLUE' },
    { id: 'cbl_002', wireNumber: 'A10102', source: 'SW-NET-01', sourceConnector: 'P02', destination: 'DSP-CORE-01', destConnector: 'LAN2', wireType: 'CAT6A', sourceRoom: 'MDF', destinationRoom: 'MDF', color: 'BLUE' },
    { id: 'cbl_003', wireNumber: 'A10201', source: 'DSP-CORE-01', sourceConnector: 'OUT1', destination: 'AMP-MAIN-L', destConnector: 'IN1', wireType: 'ANALOG-AUDIO', sourceRoom: 'MDF', destinationRoom: 'RACK-B', color: 'GRAY' },
    { id: 'cbl_004', wireNumber: 'A10202', source: 'DSP-CORE-01', sourceConnector: 'OUT2', destination: 'AMP-MAIN-R', destConnector: 'IN1', wireType: 'ANALOG-AUDIO', sourceRoom: 'MDF', destinationRoom: 'RACK-B', color: 'GRAY' },
    { id: 'cbl_005', wireNumber: 'V20101', source: 'CAM-PTZ-01', sourceConnector: 'HDMI', destination: 'TX-ENC-01', destConnector: 'HDMI-IN', wireType: 'HDMI-4K', sourceRoom: 'ROOM-101', destinationRoom: 'ROOM-101', color: 'BLACK',
      sourceRoomPath: ['Main building', 'Floor 1', 'Room 101'], destinationRoomPath: ['Main building', 'Floor 1', 'Room 101'] },
    { id: 'cbl_006', wireNumber: 'V20102', source: 'TX-ENC-01', sourceConnector: 'ETH', destination: 'SW-NET-01', destConnector: 'P24', wireType: 'CAT6A', sourceRoom: 'ROOM-101', destinationRoom: 'MDF', color: 'BLUE' },
    // a second cable at the same connector (a split): its own port, folded back on read
    { id: 'cbl_007', wireNumber: 'A10203', source: 'DSP-CORE-01', sourceConnector: 'OUT2', destination: 'AMP-FILL', destConnector: 'IN1', wireType: 'ANALOG-AUDIO', sourceRoom: 'MDF', destinationRoom: 'RACK-B', color: 'GRAY', jacket: 'LSZH' },
    // a run started from a discovered device: no far end yet, the device by its MAC (never the IP)
    runFromThing({ mac: '00:1d:c1:00:00:01', name: 'Stagebox', ips: ['10.0.0.4'] }, 8),
  ];
}

function out(name, text) {
  if (!process.env.IFC_OUT) return;
  mkdirSync(process.env.IFC_OUT, { recursive: true });
  writeFileSync(join(process.env.IFC_OUT, name), text);
}

const byType = (text, type) => parseStep(text).entities.filter((e) => e.type === type);

test('the vendored STEP codec is what contracts/src/ifc builds to today', async () => {
  const now = await buildBundle();
  if (now == null) return; // this repo on its own: the committed bundle is what there is
  assert.equal(readFileSync(BUNDLE, 'utf8'), now, 'run node scripts/vendor-ifc.mjs');
});

test('the same runs write the same bytes, and read back to the same runs', () => {
  const runs = fixtureRuns();
  const a = cablesToIfc({ runs });
  assert.match(a, /^ISO-10303-21;/);
  assert.equal(a, cablesToIfc({ runs: fixtureRuns() }));
  out('cable_labels.ifc', a);
  assert.deepEqual(cablesFromIfc(a).runs, runs);
  assert.equal(cablesToIfc(cablesFromIfc(a)), a, 'read and written again: the same file');
});

test('a cable is an IfcCableSegment: Name = Tag = the cable number, typed by its cable type, two ends', () => {
  const a = cablesToIfc({ runs: fixtureRuns() });
  const cables = byType(a, 'IFCCABLESEGMENT');
  assert.equal(cables.length, 8);
  assert.deepEqual(cables.map((c) => [c.args[2], c.args[7]]).slice(0, 2), [['A10101', 'A10101'], ['A10102', 'A10102']]);
  assert.deepEqual(byType(a, 'IFCCABLESEGMENTTYPE').map((t) => t.args[2]), ['CAT6A', 'ANALOG-AUDIO', 'HDMI-4K', 'SIGNAL']);
  assert.equal(byType(a, 'IFCRELCONNECTSPORTS').length, 15, 'two per cable, one for the run with no far end yet');
  assert.match(a, /IFCDISTRIBUTIONPORT\('[^']+',\$,'OUT2 \/ A10203',/, 'the split gets its own port');
  assert.match(a, /'FansOutOf',\$,IFCIDENTIFIER\('port:OUT2'\)/);
  assert.match(a, /'SourceDeviceId',\$,IFCIDENTIFIER\('00:1d:c1:00:00:01'\)/);
  assert.doesNotMatch(a, /10\.0\.0\.4/, 'no IP enters the model');
  assert.match(a, /'Extra',\$,IFCTEXT\('\{"jacket":"LSZH"\}'\)/, 'a column the wizard does not know rides along');
  assert.doesNotMatch(a, /MR610|stockId|forceAllCaps/, 'the label sheet is a view: not in the model');
});

test('the Wirelist\'s cables read as label runs (any IfcCableSegment model)', () => {
  const a = cablesToIfc({ runs: [{ id: 'W-1', wireNumber: 'W-1', source: 'DESK', sourceConnector: 'OUT L', destination: 'AMP', destConnector: 'IN 1', wireType: 'Mogami 2534' }] });
  const [run] = cablesFromIfc(a).runs;
  assert.deepEqual([run.wireNumber, run.source, run.sourceConnector, run.destination, run.destConnector, run.wireType], ['W-1', 'DESK', 'OUT L', 'AMP', 'IN 1', 'Mogami 2534']);
  assert.throws(() => cablesFromIfc(a.replace(/IFCCABLESEGMENT\(/g, 'IFCDISTRIBUTIONELEMENT(')), /no cables in this IFC/);
});

test('standalone Save is Save Model: cable_labels.ifc first, then cable_labels.json; Open reads either', async () => {
  const w = world({ framed: false });
  const block = toBlock({ stockId: 'MR610', config: { rows: ['{wireNumber}'], bothEnds: true }, runs: fixtureRuns() });
  const meta = blockMeta(block.runs);
  const r = await w.S.saveModel(block, { name: meta.filename, toIfc: (b) => cablesToIfc(b, { name: meta.filename }) });
  assert.equal(r.ok, true);
  assert.deepEqual(w.downloads.map((d) => d.name), ['cable_labels.ifc', 'cable_labels.json']);
  assert.equal(w.downloads[0].text, cablesToIfc(block, { name: 'cable_labels' }));
  assert.deepEqual(JSON.parse(w.downloads[1].text), block);
  const o = await w.S.openModel({ file: { name: 'cable_labels.ifc', text: () => w.downloads[0].text }, fromIfc: (t) => cablesFromIfc(t) });
  assert.equal(o.kind, 'ifc');
  assert.deepEqual(o.model.runs, block.runs);
  assert.deepEqual(fromBlock(o.model), { runs: block.runs }, 'the cables only: stock and rows stay as they are');
});

// IfcOpenShell (LGPL, test-only, never vendored) when the environment has it
test('IfcOpenShell: 0 schema + EXPRESS statements, every APK_ set declared, every link SOURCE -> SINK', { skip: !process.env.APK_IFC_PYTHON && 'set APK_IFC_PYTHON to a python with ifcopenshell + ifctester' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cablelabels-ifc-'));
  const files = { 'cable_labels.ifc': cablesToIfc({ runs: fixtureRuns() }), 'empty.ifc': cablesToIfc({ runs: [] }) };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  const script = new URL('../scripts/validate-ifc.py', import.meta.url).pathname;
  const run = spawnSync(process.env.APK_IFC_PYTHON, ['-I', script, ...Object.keys(files).map((n) => join(dir, n))], { cwd: tmpdir(), encoding: 'utf8' });
  const rows = run.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(rows.length, 2, run.stderr);
  for (const r of rows) {
    assert.equal(r.schema, 'IFC4X3_ADD2', r.file);
    assert.equal(r.statements, 0, `${r.file}: ${r.first.join(' | ')}`);
    assert.deepEqual(r.pset_problems, [], r.file);
    assert.deepEqual(r.structural, [], r.file);
  }
  assert.equal(rows[0].counts.IfcCableSegment, 8);
});
