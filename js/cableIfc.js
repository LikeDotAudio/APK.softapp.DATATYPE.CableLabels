// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* cableIfc.js — THE CABLES' .IFC TWIN (ROAD-3583). Save Model writes the native cable_labels block
   (cableHost.js toBlock) AND this IFC4X3_ADD2 file through APKSoftapp.saveModel; Open reads either back.
   A label sheet is a VIEW (stock, rows, end markers stay in the .json); the cables are the MODEL, and
   only the cables are written here. Built with the contracts STEP codec + GlobalId rule
   (vendor/apk-contracts/apk-ifc.js, scripts/vendor-ifc.mjs), no IfcOpenShell in the page.
   Byte-deterministic: the same runs write the same file.

     IfcProject ─ IfcSite ─ IfcBuilding ─ IfcBuildingStorey 'Cable labels'          units: mm
     a run      IfcCableSegment, Name = Tag = the cable number printed on the label, typed by one
                IfcCableSegmentType CABLESEGMENT per cable type (Name = 'CAT6A' …, declared in the
                project); two end ports nested in order (A, then B): device(SOURCE) → A, B → device(SINK),
                each ONE IfcRelConnectsPorts. APK_Connection.CableColour = the colour; APK_CableLabel =
                the run id, the rooms (code + full path) each end is in, the bus identity a run was
                started from, and any column the editor does not know (a CSV's extra header) as JSON
     an end     the device: IfcDistributionElement Name = Tag = the device text, one per name; its
                connector: an IfcDistributionPort Name = the connector, nested on it. A port ends one
                connection, so a second run at the same connector gets '<connector> / <cable #>' with
                APK_Terminal.FansOutOf = port:<connector>, which the reader folds back
   Everything is ISO 16739 or an APK_ set declared in DATABASE.server.BIM SRC/tools/ifc
   (apk_psets.py APK_Connection / APK_Terminal, apk_psets_editors.py APK_CableLabel). */

import { connections, entitiesByType, enumv, getPsets, ifcGuid, inverseIndex, parseStep, ports, real, ref, typed, writeStep } from '../vendor/apk-contracts/apk-ifc.js';

export const CABLE_IFC_SCHEMA = 'IFC4X3_ADD2';
const STAMP = '1970-01-01T00:00:00';   // fixed: the file is a function of the runs, never of the clock
/** The run fields the label wizard knows (labelFields.js tokens + the bus identity). */
export const RUN_FIELDS = ['id', 'wireNumber', 'source', 'sourceConnector', 'destination', 'destConnector', 'wireType',
  'sourceRoom', 'destinationRoom', 'sourceRoomPath', 'destinationRoomPath', 'color', 'sourceDeviceId'];

const str = (v) => (v == null ? '' : String(v));
const label = (s) => typed('IFCLABEL', String(s));
const ident = (s) => typed('IFCIDENTIFIER', String(s));
const text = (s) => typed('IFCTEXT', String(s));

class Writer {
  constructor() { this.entities = []; }
  add(type, ...args) {
    const id = this.entities.length + 1;
    this.entities.push({ id, type, args });
    return ref(id);
  }
}

/** What a run holds beyond RUN_FIELDS (a CSV's own columns), or null. */
function extraOf(run) {
  const keys = Object.keys(run).filter((k) => !RUN_FIELDS.includes(k) && run[k] !== undefined).sort();
  return keys.length ? JSON.stringify(Object.fromEntries(keys.map((k) => [k, run[k]]))) : null;
}

/** The runs ({ runs } state, a cable_labels block, or a list) as IFC4X3_ADD2 STEP text. */
export function cablesToIfc(input, { name = 'cable_labels' } = {}) {
  const runs = Array.isArray(input) ? input : Array.isArray(input?.runs) ? input.runs : [];
  const stem = String(name).replace(/\.(ifc|json)$/i, '');
  const W = new Writer();
  const P = ifcGuid('cablelabels', stem);
  const rel = (...roles) => ifcGuid('rel', ...roles);

  const mm = W.add('IFCSIUNIT', { kind: 'derived' }, enumv('LENGTHUNIT'), enumv('MILLI'), enumv('METRE'));
  const units = W.add('IFCUNITASSIGNMENT', [mm]);
  const origin = W.add('IFCAXIS2PLACEMENT3D', W.add('IFCCARTESIANPOINT', [real(0), real(0), real(0)]), null, null);
  const ctx = W.add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, real(1e-5), origin, null);
  const project = W.add('IFCPROJECT', P, null, stem, 'Cable Label Wizard: the cables the labels are for', null, null, null, [ctx], units);
  const sitePl = W.add('IFCLOCALPLACEMENT', null, origin);
  const buildingPl = W.add('IFCLOCALPLACEMENT', sitePl, origin);
  const storeyPl = W.add('IFCLOCALPLACEMENT', buildingPl, origin);
  const siteGid = ifcGuid('site', P, 'site');
  const buildingGid = ifcGuid('site', P, 'building');
  const storeyGid = ifcGuid('site', P, 'storey');
  const site = W.add('IFCSITE', siteGid, null, 'Site', null, null, sitePl, null, null, enumv('ELEMENT'), null, null, null, null, null);
  const building = W.add('IFCBUILDING', buildingGid, null, 'Building', null, null, buildingPl, null, null, enumv('ELEMENT'), null, null, null);
  const storey = W.add('IFCBUILDINGSTOREY', storeyGid, null, 'Cable labels', null, null, storeyPl, null, null, enumv('ELEMENT'), real(0));
  W.add('IFCRELAGGREGATES', rel('aggregates', P), null, null, null, project, [site]);
  W.add('IFCRELAGGREGATES', rel('aggregates', siteGid), null, null, null, site, [building]);
  W.add('IFCRELAGGREGATES', rel('aggregates', buildingGid), null, null, null, building, [storey]);

  const pset = (owner, ownerGid, setName, list) => {
    const props = list.filter(([, v]) => v != null).map(([n, v]) => (Array.isArray(v)
      ? W.add('IFCPROPERTYLISTVALUE', n, null, v, null)
      : W.add('IFCPROPERTYSINGLEVALUE', n, null, v, null)));
    if (!props.length) return;
    const ps = W.add('IFCPROPERTYSET', ifcGuid('rel', 'pset', ownerGid, setName), null, setName, null, props);
    W.add('IFCRELDEFINESBYPROPERTIES', ifcGuid('rel', 'props', ownerGid, setName), null, null, null, [owner], ps);
  };
  const contained = [];
  const nests = [];   // [host ref, host gid, [port refs]], written at the end with the ports in order

  const devices = new Map();   // device text -> { ref, gid, uses, list }
  const deviceFor = (dev) => {
    if (devices.has(dev)) return devices.get(dev);
    const gid = ifcGuid('decl', P, 'device', dev);
    const el = W.add('IFCDISTRIBUTIONELEMENT', gid, null, dev, null, null, null, null, dev);
    const d = { ref: el, gid, uses: new Map(), list: [] };
    devices.set(dev, d);
    contained.push(el);
    nests.push([el, gid, d.list]);
    return d;
  };
  const portFor = (d, connector, cableKey, flow) => {
    const n = d.uses.get(connector) || 0;
    d.uses.set(connector, n + 1);
    const fan = n > 0;
    const gid = fan ? ifcGuid(d.gid, 'port', connector, 'fan', cableKey) : ifcGuid(d.gid, 'port', connector);
    const p = W.add('IFCDISTRIBUTIONPORT', gid, null, fan ? `${connector} / ${cableKey}` : connector || null, null, null, null, null, enumv(flow), enumv('CABLE'), null);
    d.list.push(p);
    if (fan) pset(p, gid, 'APK_Terminal', [['FansOutOf', ident(`port:${connector}`)]]);
    return p;
  };

  const types = new Map();   // cable type text -> { ref, gid, occ }
  const typeFor = (t) => {
    if (!types.has(t)) {
      const gid = ifcGuid('decl', P, 'cabletype', t);
      types.set(t, { ref: W.add('IFCCABLESEGMENTTYPE', gid, null, t, null, null, null, null, null, null, enumv('CABLESEGMENT')), gid, occ: [] });
    }
    return types.get(t);
  };

  const taken = new Set();
  runs.forEach((run, i) => {
    let key = str(run.id) || `run-${i + 1}`;
    while (taken.has(key)) key = `${key}#${i + 1}`;
    taken.add(key);
    const gid = ifcGuid('decl', P, 'cable', key);
    const number = str(run.wireNumber);
    const t = str(run.wireType) ? typeFor(str(run.wireType)) : null;
    const cable = W.add('IFCCABLESEGMENT', gid, null, number || null, null, null, null, null, number || null, t ? null : enumv('CABLESEGMENT'));
    if (t) t.occ.push(cable);
    contained.push(cable);
    const endA = W.add('IFCDISTRIBUTIONPORT', ifcGuid(gid, 'end', 'A'), null, 'A', null, null, null, null, enumv('SINK'), enumv('CABLE'), null);
    const endB = W.add('IFCDISTRIBUTIONPORT', ifcGuid(gid, 'end', 'B'), null, 'B', null, null, null, null, enumv('SOURCE'), enumv('CABLE'), null);
    nests.push([cable, gid, [endA, endB]]);
    const fanKey = number || key;
    if (str(run.source)) {
      const pa = portFor(deviceFor(str(run.source)), str(run.sourceConnector), fanKey, 'SOURCE');
      W.add('IFCRELCONNECTSPORTS', rel('connects', P, key, 'A'), null, number || key, null, pa, endA, null);
    }
    if (str(run.destination)) {
      const pb = portFor(deviceFor(str(run.destination)), str(run.destConnector), fanKey, 'SINK');
      W.add('IFCRELCONNECTSPORTS', rel('connects', P, key, 'B'), null, number || key, null, endB, pb, null);
    }
    const path = (v) => (Array.isArray(v) && v.length ? v.map((s) => label(str(s))) : null);
    const extra = extraOf(run);
    pset(cable, gid, 'APK_CableLabel', [
      ['RunId', str(run.id) ? ident(run.id) : null],
      ['SourceRoom', str(run.sourceRoom) ? label(run.sourceRoom) : null],
      ['DestinationRoom', str(run.destinationRoom) ? label(run.destinationRoom) : null],
      ['SourceRoomPath', path(run.sourceRoomPath)],
      ['DestinationRoomPath', path(run.destinationRoomPath)],
      ['SourceDeviceId', str(run.sourceDeviceId) ? ident(run.sourceDeviceId) : null],
      ['Extra', extra ? text(extra) : null],
    ]);
    pset(cable, gid, 'APK_Connection', [['CableColour', str(run.color) ? label(run.color) : null]]);
  });

  for (const [host, gid, list] of nests) if (list.length) W.add('IFCRELNESTS', rel('nests', gid), null, null, null, host, list);
  const typeList = [...types.values()];
  if (typeList.length) W.add('IFCRELDECLARES', rel('declares', P), null, null, null, project, typeList.map((t) => t.ref));
  for (const t of typeList) if (t.occ.length) W.add('IFCRELDEFINESBYTYPE', rel('type', t.gid), null, null, null, t.occ, t.ref);
  if (contained.length) W.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', rel('contains', storeyGid), null, null, null, contained, storey);

  return writeStep({
    header: [
      { type: 'FILE_DESCRIPTION', args: [['ViewDefinition [ReferenceView]'], '2;1'] },
      { type: 'FILE_NAME', args: [`${stem}.ifc`, STAMP, ['APK.audio'], ['APK.audio'], 'Cable Label Wizard', 'DATATYPE.CableLabels', ''] },
      { type: 'FILE_SCHEMA', args: [[CABLE_IFC_SCHEMA]] },
    ],
    entities: W.entities,
  });
}

/* ───────────────────────── reading it back ───────────────────────── */

/**
 * An IFC model → { runs }: one run per IfcCableSegment (this twin, the Wirelist's, a bench's), its ends
 * from the IfcRelConnectsPorts at its A / B ports. Throws a sentence when the file has no cable.
 */
export function cablesFromIfc(stepText) {
  const file = parseStep(String(stepText));
  const cables = entitiesByType(file, 'IFCCABLESEGMENT');
  if (!cables.length) throw new TypeError('no cables in this IFC: it has no IfcCableSegment');
  const inv = inverseIndex(file);
  const hostOf = (port) => {
    const nest = (inv.get(port.id) || []).find((r) => r.type === 'IFCRELNESTS' && (r.args[5] || []).some((x) => x && x.id === port.id));
    return nest ? file.byId.get(nest.args[4]?.id) : undefined;
  };
  const joins = connections(file);
  const farEnd = (end) => {
    const c = joins.find((j) => j.related === end || j.relating === end);
    return c ? (c.related === end ? c.relating : c.related) : undefined;
  };
  const typeName = (cable) => {
    const r = (inv.get(cable.id) || []).find((x) => x.type === 'IFCRELDEFINESBYTYPE');
    const t = r && file.byId.get(r.args[5]?.id);
    return t && typeof t.args[2] === 'string' ? t.args[2] : '';
  };
  const endOf = (cable, which) => {
    const list = ports(file, cable);
    const end = list.find((p) => p.args[2] === which) || list[which === 'A' ? 0 : 1];
    const port = end && farEnd(end);
    if (!port) return { device: '', connector: '' };
    const dev = hostOf(port);
    const fan = getPsets(file, port).APK_Terminal?.FansOutOf;
    const connector = typeof fan === 'string' && fan.startsWith('port:') ? fan.slice(5) : str(port.args[2]);
    return { device: dev ? str(dev.args[2]) || str(dev.args[7]) : '', connector };
  };
  const runs = cables.map((c, i) => {
    const ps = getPsets(file, c);
    const L = ps.APK_CableLabel || {};
    const a = endOf(c, 'A');
    const b = endOf(c, 'B');
    const run = {
      id: str(L.RunId) || `cbl_${i + 1}`,
      wireNumber: str(c.args[7]) || str(c.args[2]),
      source: a.device,
      sourceConnector: a.connector,
      destination: b.device,
      destConnector: b.connector,
      wireType: typeName(c),
      sourceRoom: str(L.SourceRoom),
      destinationRoom: str(L.DestinationRoom),
      color: str(ps.APK_Connection?.CableColour),
    };
    if (Array.isArray(L.SourceRoomPath)) run.sourceRoomPath = L.SourceRoomPath.map(str);
    if (Array.isArray(L.DestinationRoomPath)) run.destinationRoomPath = L.DestinationRoomPath.map(str);
    if (str(L.SourceDeviceId)) run.sourceDeviceId = str(L.SourceDeviceId);
    if (typeof L.Extra === 'string') {
      try { Object.assign(run, JSON.parse(L.Extra)); } catch { /* a hand-edited Extra that is not JSON: the known fields stand */ }
    }
    return run;
  });
  return { runs };
}
