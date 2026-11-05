// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* cableHost.js — the cable-label block in and out of the CAD over
   cad.like.audio/host@1, through the vendored APKSoftapp client (ROAD-3485 /
   ROAD-3491). No DOM here: the round-trip test drives it with the real client. */

export const EDITOR = 'Cable Label Wizard';
export const BLOCK_TYPE = 'cable_labels';

/** Any list of cables / wires / connections as label runs. */
export function normalizeRuns(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((item, idx) => ({
    id: item.id || `cbl_${idx + 1}`,
    wireNumber: item.wireNumber || item.number || item.label || `CBL-${idx + 1}`,
    source: item.source || item.fromDevice || item.from || 'SRC',
    sourceConnector: item.sourceConnector || item.fromPort || '',
    destination: item.destination || item.toDevice || item.to || 'DEST',
    destConnector: item.destConnector || item.toPort || '',
    wireType: item.wireType || item.type || 'SIGNAL',
    sourceRoom: item.sourceRoom || '',
    destinationRoom: item.destinationRoom || '',
    color: item.color || '',
  }));
}

/** The block the CAD stores: { type, stockId, config, runs }. */
export function toBlock({ stockId, config, runs }) {
  return { type: BLOCK_TYPE, stockId, config, runs };
}

export function blockMeta(runs) {
  return { title: `Cable Labels (${runs.length} runs)`, filename: 'cable_labels' };
}

/** What a loaded block sets: { runs?, stockId?, config? } (missing keys stay as they are). */
export function fromBlock(block) {
  const out = {};
  if (!block) return out;
  if (Array.isArray(block)) out.runs = normalizeRuns(block);
  else if (Array.isArray(block.runs)) out.runs = block.runs;
  else if (Array.isArray(block.cables)) out.runs = normalizeRuns(block.cables);
  if (block.stockId) out.stockId = block.stockId;
  if (block.config && typeof block.config === 'object') out.config = block.config;
  return out;
}

/** A new run that starts at a discovered thing (APKSoftapp.discovered): named, never keyed, by its IP. */
export function runFromThing(thing, n) {
  const id = thing && (thing.mac || thing.serial || thing.agent);
  return {
    id: `cbl_${n}`,
    wireNumber: `CBL-${n}`,
    source: (thing && thing.name) || id || 'SRC',
    sourceDeviceId: id || '',
    sourceConnector: '',
    destination: '',
    destConnector: '',
    wireType: 'SIGNAL',
    sourceRoom: '',
    destinationRoom: '',
    color: '',
  };
}

/**
 * getState() → { stockId, config, runs }; onLoad(parts, meta, block) applies fromBlock(block).
 * Returns the APKSoftapp host handle.
 */
export function connectCableHost(S, { getState, onLoad, notice } = {}) {
  return S.connectHost({
    editor: EDITOR,
    blockType: BLOCK_TYPE,
    block: toBlock(getState()),
    notice,
    onLoad: (block, meta) => { if (onLoad) onLoad(fromBlock(block), meta, block); },
    onRequest: () => {
      const st = getState();
      return { block: toBlock(st), meta: blockMeta(st.runs) };
    },
  });
}
