// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * Label stock — the physical sheet, in millimetres.
 *
 * Everything downstream (the SVG preview, the PDF writer, the cell arithmetic)
 * reads a `LabelStock` and nothing else, so "what the sheet is" is stated once.
 *
 * `printArea` is the key architectural distinction:
 * A wrap-around cable label is NOT a simple rectangle you may print in: the top
 * band is the printed flag and the rest is the clear tail that laminates over it.
 * Text drawn below `printArea.height` ends up on the tail, which reads as a sheet
 * of blank cables once wrapped around the wire.
 */

export const MM_PER_INCH = 25.4;

export const roundMm = (mm) => Math.round(mm * 100) / 100;

/** MR610 — 57.2 × 25.4 mm, US Letter, 32 wrap-around cable labels (8 across × 4 down). */
export const MR610 = {
  id: 'mr610',
  name: 'MR610 — 57.2 × 25.4 mm wrap-around (32/sheet)',
  vendor: 'Mr-Label',
  origin: 'built-in',
  sheet: { width: 215.9, height: 279.4 },
  margin: { top: 10.3, right: 6.35, bottom: 10.3, left: 6.35 },
  grid: { across: 8, down: 4 },
  label: { width: 25.4, height: 57.2 },
  printArea: { width: 25.4, height: 19.1 },
  spacing: { horizontal: 0, vertical: 10 },
  pitch: { horizontal: 25.4, vertical: 67.2 },
};

/** MR610 (tall flag) — 25.1 mm printable flag area for 3-4 dense rows. */
export const MR610_TALL_FLAG = {
  ...MR610,
  id: 'mr610-tall-flag',
  name: 'MR610 (tall flag) — 25.1 mm print area, 32/sheet',
  origin: 'built-in',
  printArea: { width: 25.4, height: 25.1 },
};

/** Wrap-around A4 — 57.2 × 25.4 mm (32/sheet, A4). */
export const MR610_A4 = {
  id: 'mr610-a4',
  name: 'Wrap-around A4 — 57.2 × 25.4 mm (32/sheet)',
  vendor: 'generic',
  origin: 'built-in',
  sheet: { width: 210, height: 297 },
  margin: { top: 19.1, right: 3.4, bottom: 19.1, left: 3.4 },
  grid: { across: 8, down: 4 },
  label: { width: 25.4, height: 57.2 },
  printArea: { width: 25.4, height: 19.1 },
  spacing: { horizontal: 0, vertical: 10 },
  pitch: { horizontal: 25.4, vertical: 67.2 },
};

export const BUILT_IN_STOCK = [MR610, MR610_TALL_FLAG, MR610_A4];
export const LABEL_STOCKS = BUILT_IN_STOCK;

export function getStock(id) {
  const norm = String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const found = BUILT_IN_STOCK.find(s => s.id.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
  const stock = found || MR610;
  // Normalize fields for easy access across consumers
  return {
    ...stock,
    margins: stock.margin,
    sheet: {
      ...stock.sheet,
      standard: stock.sheet.width > 215 ? 'US Letter' : 'A4',
    },
    grid: {
      ...stock.grid,
      cols: stock.grid.across,
      rows: stock.grid.down,
    },
  };
}

export const DEFAULT_STOCK_ID = MR610.id;

export const labelsPerSheet = (stock) =>
  Math.max(0, stock.grid.across) * Math.max(0, stock.grid.down);

/** Top-left corner of cell `index` (0-based, row-major) in sheet millimetres. */
export function cellOrigin(stock, index) {
  const col = index % stock.grid.across;
  const row = Math.floor(index / stock.grid.across);
  return {
    x: roundMm(stock.margin.left + col * stock.pitch.horizontal),
    y: roundMm(stock.margin.top + row * stock.pitch.vertical),
  };
}

/** The printable rectangle of cell `index` — the top band, not the whole label. */
export function cellPrintRect(stock, index) {
  const { x, y } = cellOrigin(stock, index);
  const inset = (stock.label.width - stock.printArea.width) / 2;
  return {
    x: roundMm(x + inset),
    y,
    width: stock.printArea.width,
    height: stock.printArea.height,
  };
}
