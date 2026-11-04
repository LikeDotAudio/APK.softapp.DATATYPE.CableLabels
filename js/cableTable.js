// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// THE ONE TABLE (ROAD-3494): the cable-run schedule is an APKTable
// (vendor/apk-table, held to /FrontEnd/shared by check.sh webshared), so any
// script reaches it as APKTable.get('cable-labels-runs'). Cells are edited in
// place (text, committed on Enter or blur); the ✕ column deletes a run.

export const CABLE_COLUMNS = [
  { key: '_n', label: '#', editable: false, width: '32px' },
  { key: 'wireNumber', label: 'Cable #', mono: true },
  { key: 'source', label: 'Source Device' },
  { key: 'sourceConnector', label: 'Src Conn' },
  { key: 'destination', label: 'Destination Device' },
  { key: 'destConnector', label: 'Dest Conn' },
  { key: 'wireType', label: 'Type' },
  { key: 'sourceRoom', label: 'Src Room' },
  { key: 'destinationRoom', label: 'Dest Room' },
];

/** Mount (or refresh) the run table. `runs` is the app's own array: an edit
 *  writes into it, so the label preview reads the same objects. */
export function cableTable(host, runs, { onEdit, onDelete } = {}) {
  const T = globalThis.APKTable;
  if (!host || !T) return null;
  // '#' is the run's position, shown, never stored back.
  runs.forEach((r, i) => { Object.defineProperty(r, '_n', { value: i + 1, enumerable: false, configurable: true, writable: true }); });
  if (host.apkTable) return host.apkTable.setRows(runs);   // keeps the filter and sort
  host.apkTable = T.create(host, {
    id: 'cable-labels-runs',
    searchPlaceholder: 'Filter cables',
    empty: 'No cable runs. Add one, or import a CSV.',
    columns: CABLE_COLUMNS,
    rows: runs,
    onEdit: (i, key, value, row) => { if (onEdit) onEdit(i, key, value, row); },
    onDelete: (i, row) => { if (onDelete) onDelete(i, row); },
  });
  return host.apkTable;
}
