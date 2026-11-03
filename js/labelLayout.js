// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { TOKEN_BY_NAME, DEFAULT_ROW_TEMPLATES, codeForRun } from './labelFields.js';
import { toPrintableText } from './labelPrintableText.js';
import { wrapToWidth } from './wrapText.js';
import { cellOrigin, cellPrintRect, labelsPerSheet } from './labelStock.js';

const TOKEN_RE = /\{([a-zA-Z]+)\}/g;

export function renderRow(template, run) {
  if (!template) return '';
  const out = template.replace(TOKEN_RE, (whole, name) => {
    const token = TOKEN_BY_NAME.get(name);
    if (!token) return whole;
    return (token.read(run) ?? '').toString().trim();
  });
  const tidied = out.replace(/\s{2,}/g, ' ').replace(/^[\s/>–—-]+|[\s/>–—-]+$/g, '').trim();
  return toPrintableText(tidied);
}

export const DEFAULT_FONT_STEPS = [7, 6, 5];
export const MIN_WRAP_PT = 3;
export const WRAP_LINE = 1.15;
export const PT_MM = 25.4 / 72;

export function fitRow(text, maxWidthMm, measure, steps = DEFAULT_FONT_STEPS, maxHeightMm = Infinity) {
  if (!text) return { text: '', lines: [], fontPt: steps[0], wrapped: false };

  for (const fontPt of steps) {
    if (measure(text, fontPt) <= maxWidthMm) {
      return { text, lines: [text], fontPt, wrapped: false };
    }
  }

  const wrapAt = (fontPt) => {
    const lines = wrapToWidth(text, maxWidthMm, s => measure(s, fontPt));
    return { text: lines.join('\n'), lines, fontPt, wrapped: lines.length > 1 };
  };

  const fits = (r) => r.lines.length * r.fontPt * PT_MM * WRAP_LINE <= maxHeightMm;

  for (const fontPt of steps) {
    const r = wrapAt(fontPt);
    if (fits(r)) return r;
  }

  let fontPt = steps[steps.length - 1];
  for (let i = 0; i < 10; i++) {
    const next = fontPt * 0.9;
    if (next < MIN_WRAP_PT) return wrapAt(fontPt);
    fontPt = next;
    const r = wrapAt(fontPt);
    if (fits(r)) return r;
  }
  return wrapAt(fontPt);
}

export function rowBaselines(rowTop, lineBox, fitted, ratio = 0.74) {
  if (fitted.lines.length <= 1) return [rowTop + lineBox * ratio];
  const lead = fitted.fontPt * PT_MM * WRAP_LINE;
  const first = rowTop + (lineBox - fitted.lines.length * lead) / 2 + lead * 0.8;
  return fitted.lines.map((_, i) => first + i * lead);
}

export const BLANK_CELL = { runId: null, end: null, rows: ['', '', ''], code: null };

const applyCaps = (rows, on) =>
  on ? [rows[0].toUpperCase(), rows[1].toUpperCase(), rows[2].toUpperCase()] : rows;

export function cellsForRun(run, config) {
  const base = config.rows.map(t => renderRow(t, run));
  const code = codeForRun(run);

  if (!config.bothEnds) {
    return [{ runId: run.id, end: null, rows: applyCaps(base, config.forceAllCaps), code }];
  }

  const mark = (rows, end) => {
    if (config.endMarker === 'ab' || config.endMarker === 'srcdest') {
      const tag = config.endMarker === 'ab' ? `(${end})` : (end === 'A' ? '[SRC]' : '[DEST]');
      return [`${rows[0] ? `${rows[0]} ` : ''}${tag}`, rows[1], rows[2]];
    }
    if (config.endMarker === 'swap' && end === 'B') {
      return [rows[0], rows[2], rows[1]];
    }
    return rows;
  };

  return [
    { runId: run.id, end: 'A', rows: applyCaps(mark(base, 'A'), config.forceAllCaps), code },
    { runId: run.id, end: 'B', rows: applyCaps(mark(base, 'B'), config.forceAllCaps), code },
  ];
}

export function buildCells(runs, config) {
  const offset = Math.max(0, Math.floor(config.startOffset || 0));
  const skipped = Array.from({ length: offset }, () => BLANK_CELL);
  return [...skipped, ...runs.flatMap(run => cellsForRun(run, config))];
}

export function paginate(cells, stock) {
  const perSheet = labelsPerSheet(stock);
  if (perSheet <= 0 || cells.length === 0) return [];

  const pages = [];
  for (let start = 0; start < cells.length; start += perSheet) {
    const slice = cells.slice(start, start + perSheet);
    while (slice.length < perSheet) slice.push(BLANK_CELL);
    pages.push({
      pageIndex: pages.length,
      cells: slice.map((cell, index) => {
        const origin = cellOrigin(stock, index);
        return {
          ...cell,
          index,
          x: origin.x,
          y: origin.y,
          width: stock.label.width,
          height: stock.label.height,
          print: cellPrintRect(stock, index),
        };
      }),
    });
  }
  return pages;
}

export function codeSquareFor(cell, code, paddingMm) {
  const textX = cell.print.x + paddingMm;
  const textWidth = Math.max(1, cell.print.width - paddingMm * 2);
  return { square: null, textX, textWidth };
}

export function layoutSheets(runs, config, stock) {
  return paginate(buildCells(runs, config), stock);
}
