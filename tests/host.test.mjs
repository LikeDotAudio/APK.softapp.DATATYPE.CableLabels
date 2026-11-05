// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// The cable-label block round trip over cad.like.audio/host@1 (ROAD-3491), with
// the app's vendored APKSoftapp client in a stub window.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { connectCableHost, fromBlock, toBlock, runFromThing, EDITOR, BLOCK_TYPE } from '../js/cableHost.js';

const require = createRequire(import.meta.url);
const { world, hostContract } = require('./host-world.cjs');

test('load → edit → request: the CAD gets the edited runs back, at our origin, on host@1', async () => {
  const w = world();
  const st = { stockId: 'MR610', config: { rows: ['{wire}'], bothEnds: true }, runs: [] };
  const loads = [];
  const host = connectCableHost(w.S, {
    notice: false,
    getState: () => st,
    onLoad: (parts, meta) => { loads.push(meta); Object.assign(st, parts); },
  });
  assert.ok(host.embedded);
  assert.deepEqual(w.toParent[0], { m: { protocol: 'cad.like.audio/host@1', type: 'editorReady', editor: EDITOR, blockType: BLOCK_TYPE }, o: w.ORIGIN });

  w.fire({ protocol: w.S.PROTOCOL, type: 'load', block: toBlock({ stockId: 'MR610', config: st.config, runs: [{ id: 'c1', wireNumber: 'A1', source: 'SW', destination: 'DSP' }] }), meta: { blockName: 'LABELS_1' } });
  assert.deepEqual(loads, [{ blockName: 'LABELS_1' }]);
  assert.equal(st.runs.length, 1);

  st.runs.push(runFromThing({ mac: '00:1d:c1:00:00:01', name: 'Stagebox', ips: ['10.0.0.4'] }, 2));
  w.fire({ protocol: w.S.PROTOCOL, type: 'request' });
  const save = w.toParent.at(-1);
  assert.equal(save.o, w.ORIGIN, 'never "*"');
  assert.equal(save.m.type, 'blockSave');
  assert.equal(save.m.meta.blockName, 'LABELS_1');
  assert.equal(save.m.meta.title, 'Cable Labels (2 runs)');
  assert.deepEqual(save.m.block.runs.map((r) => r.source), ['SW', 'Stagebox']);
  assert.equal(save.m.block.runs[1].sourceDeviceId, '00:1d:c1:00:00:01', 'the device by MAC, not IP');
  assert.deepEqual(fromBlock(save.m.block).runs, save.m.block.runs, 'the block survives a reload');

  const c = await hostContract();
  if (c) for (const { m } of w.toParent) assert.deepEqual(c.validateMessage(c.schema, 'toCad', m), [], m.type);
});

test('fromBlock takes runs, a cables list, or a bare array', () => {
  assert.equal(fromBlock({ cables: [{ fromDevice: 'A', toDevice: 'B' }] }).runs[0].destination, 'B');
  assert.equal(fromBlock([{ from: 'X' }]).runs[0].source, 'X');
  assert.deepEqual(fromBlock(null), {});
});

test('standalone, save downloads one .json', () => {
  const w = world({ framed: false });
  const st = { stockId: 'MR610', config: {}, runs: [] };
  const host = connectCableHost(w.S, { notice: false, getState: () => st });
  assert.equal(host.save(toBlock(st), { filename: 'cable_labels' }), 'download');
  assert.deepEqual(w.downloads.map((d) => d.name), ['cable_labels.json']);
});

test('index.html loads the softapp client before the app module, and no private bridge is left', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const at = (s) => html.indexOf(s);
  assert.ok(at('vendor/apk-contracts/apk-contracts.global.js') > 0);
  assert.ok(at('/FrontEnd/shared/apk-bus.js') > at('apk-contracts.global.js'));
  assert.ok(at('vendor/apk-softapp/apk-softapp.js') > at('/FrontEnd/shared/apk-bus.js'));
  assert.ok(at('js/cableWizardApp.js') > at('vendor/apk-softapp/apk-softapp.js'));
  assert.equal(fs.existsSync(new URL('../js/blockBridge.js', import.meta.url)), false);
});
