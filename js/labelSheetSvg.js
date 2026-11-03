// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { fitRow, rowBaselines, DEFAULT_FONT_STEPS } from './labelLayout.js';

export const PT_TO_MM = 25.4 / 72;
const BASELINE_RATIO = 0.74;
const SIDE_PADDING_MM = 0.8;

const WIDE = new Set('MW@%'.split(''));
const NARROW = new Set("iljtfr.,:;'|![]() ".split(''));

export const approximateMeasurer = (text, fontPt) => {
  let factor = 0;
  for (const ch of String(text || '')) {
    if (WIDE.has(ch)) factor += 0.95;
    else if (NARROW.has(ch)) factor += 0.36;
    else if (ch >= 'A' && ch <= 'Z') factor += 0.75;
    else if (ch >= '0' && ch <= '9') factor += 0.62;
    else factor += 0.64;
  }
  return factor * fontPt * PT_TO_MM;
};

export function makeCanvasMeasurer() {
  if (typeof document === 'undefined') return approximateMeasurer;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return approximateMeasurer;
  return (text, fontPt) => {
    ctx.font = `bold ${fontPt * 100}px Helvetica, Arial, sans-serif`;
    return (ctx.measureText(text).width / 100) * PT_TO_MM;
  };
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function buildSheetSvg(page, stock, options = {}) {
  const {
    measure = approximateMeasurer,
    fontSteps = DEFAULT_FONT_STEPS,
    showCellNumbers = true,
    theme = 'dark',
  } = options;

  const isDark = theme === 'dark';
  const paper = isDark ? '#080C16' : '#ffffff';
  const edge = isDark ? '#1E2A45' : '#c8ced6';
  const dieLine = isDark ? '#2D3D60' : '#aab3bd';
  const flag = isDark ? '#121A2F' : '#fdfdfd';
  const tailWash = isDark ? '#0E1424' : '#f0f3f8';
  const ink = isDark ? '#F0F4F8' : '#080C16';
  const faint = isDark ? '#8B9BB4' : '#6b7a90';
  const accent = isDark ? '#F4902C' : '#D06000';

  const parts = [];

  // Sheet boundary
  parts.push(`<rect x="0" y="0" width="${stock.sheet.width}" height="${stock.sheet.height}" fill="${paper}" stroke="${edge}" stroke-width="0.3"/>`);

  // Scale calibration check rule (100mm) at the bottom or margin
  const ruleX = stock.margins.left;
  const ruleY = stock.sheet.height - 4;
  if (ruleY > 10) {
    parts.push(`<line x1="${ruleX}" y1="${ruleY}" x2="${ruleX + 100}" y2="${ruleY}" stroke="${accent}" stroke-width="0.3"/>`);
    parts.push(`<line x1="${ruleX}" y1="${ruleY - 1.5}" x2="${ruleX}" y2="${ruleY + 1.5}" stroke="${accent}" stroke-width="0.3"/>`);
    parts.push(`<line x1="${ruleX + 100}" y1="${ruleY - 1.5}" x2="${ruleX + 100}" y2="${ruleY + 1.5}" stroke="${accent}" stroke-width="0.3"/>`);
    parts.push(`<text x="${ruleX + 50}" y="${ruleY - 1}" fill="${accent}" font-size="2" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">100 mm scale check</text>`);
  }

  // Draw cells
  for (const cell of page.cells) {
    // Die cut border
    parts.push(`<rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" fill="none" stroke="${dieLine}" stroke-width="0.2"/>`);

    // Laminating tail
    const tailY = cell.print.y + cell.print.height;
    const tailH = cell.height - cell.print.height;
    if (tailH > 0.2) {
      parts.push(`<rect x="${cell.x}" y="${tailY}" width="${cell.width}" height="${tailH}" fill="${tailWash}" stroke="none"/>`);
      parts.push(`<line x1="${cell.x}" y1="${tailY}" x2="${cell.x + cell.width}" y2="${tailY}" stroke="${dieLine}" stroke-width="0.2" stroke-dasharray="1 1"/>`);
    }

    // Printable flag
    parts.push(`<rect x="${cell.print.x}" y="${cell.print.y}" width="${cell.print.width}" height="${cell.print.height}" fill="${flag}" stroke="none"/>`);

    if (!cell.runId) {
      if (showCellNumbers) {
        parts.push(`<text x="${cell.print.x + cell.print.width / 2}" y="${cell.print.y + cell.print.height / 2 + 1}" `
          + `fill="${faint}" font-size="3.5" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${cell.index + 1}</text>`);
      }
      continue;
    }

    const maxWidth = cell.print.width - SIDE_PADDING_MM * 2;
    const lineBox = cell.print.height / 3;
    const centreX = cell.print.x + cell.print.width / 2;

    cell.rows.forEach((raw, rowIdx) => {
      if (!raw) return;
      const fitted = fitRow(raw, maxWidth, measure, fontSteps, lineBox);
      const ys = rowBaselines(cell.print.y + lineBox * rowIdx, lineBox, fitted, BASELINE_RATIO);
      fitted.lines.forEach((line, i) => {
        parts.push(`<text x="${centreX}" y="${ys[i]}" fill="${ink}" font-size="${fitted.fontPt * PT_TO_MM}" `
          + `font-weight="bold" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"${fitted.wrapped && i === 0 ? ' data-wrapped="1"' : ''}>`
          + `${esc(line)}</text>`);
      });
    });

    if (cell.end) {
      parts.push(`<text x="${cell.x + 0.8}" y="${cell.y + 2.5}" fill="${accent}" font-size="1.8" font-weight="bold" font-family="Helvetica, Arial, sans-serif">${esc(cell.end)}</text>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stock.sheet.width} ${stock.sheet.height}" `
    + `width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" `
    + `aria-label="Label sheet preview, page ${page.pageIndex + 1}">`
    + parts.join('')
    + `</svg>`;
}
