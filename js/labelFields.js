// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * Cable label fields vocabulary and tokens.
 */

const UNNUMBERED_REGEX = /^(?:N\/?A|TBD|\?+|0{4,}|NONE|UNASSIGNED|--+)$/i;

export function isUnnumbered(value) {
  if (!value) return true;
  const str = String(value).trim();
  return str.length === 0 || UNNUMBERED_REGEX.test(str);
}

export function codeForRun(run) {
  if (!run || !run.id) return null;
  if (isUnnumbered(run.wireNumber)) return null;
  return `APK:CBL:${run.id}`;
}

const prose = (segments, fallback) =>
  (Array.isArray(segments) && segments.length ? segments.join(' > ') : (fallback || ''));

export const FIELD_TOKENS = [
  { token: 'wireNumber', label: 'Cable Number', read: r => r.wireNumber || '' },
  { token: 'source', label: 'Source Device', read: r => r.source || '' },
  { token: 'destination', label: 'Destination Device', read: r => r.destination || '' },
  { token: 'sourceConnector', label: 'Source Connector', read: r => r.sourceConnector || '' },
  { token: 'destConnector', label: 'Destination Connector', read: r => r.destConnector || '' },
  { token: 'wireType', label: 'Cable Type', read: r => r.wireType || '' },
  { token: 'sourceRoom', label: 'Source Room (code)', read: r => r.sourceRoom || '' },
  { token: 'destinationRoom', label: 'Destination Room (code)', read: r => r.destinationRoom || '' },
  { token: 'sourceRoomPath', label: 'Source Room (full)', read: r => prose(r.sourceRoomPath, r.sourceRoom) },
  { token: 'destinationRoomPath', label: 'Destination Room (full)', read: r => prose(r.destinationRoomPath, r.destinationRoom) },
  { token: 'color', label: 'Colour', read: r => r.color || '' },
  { token: 'code', label: 'Scan Code', read: r => codeForRun(r) ?? '' },
];

export const TOKEN_BY_NAME = new Map(FIELD_TOKENS.map(t => [t.token, t]));

export const ROW_PRESETS = [
  { label: '— (blank)', template: '' },
  { label: 'Cable Number', template: '{wireNumber}' },
  { label: 'Source', template: '{source}' },
  { label: 'Destination', template: '{destination}' },
  { label: 'Source + Connector', template: '{source} / {sourceConnector}' },
  { label: 'Destination + Connector', template: '{destination} / {destConnector}' },
  { label: 'Cable Type', template: '{wireType}' },
  { label: 'Source Room (code)', template: '{sourceRoom}' },
  { label: 'Destination Room (code)', template: '{destinationRoom}' },
  { label: 'Room to Room (code)', template: '{sourceRoom} > {destinationRoom}' },
  { label: 'Source → Destination', template: '{source} > {destination}' },
  { label: 'Colour', template: '{color}' },
  { label: 'Scan Code (text)', template: '{code}' },
];

export const DEFAULT_ROW_TEMPLATES = [
  '{wireNumber}',
  '{source} / {sourceConnector}',
  '{destination} / {destConnector}',
];
