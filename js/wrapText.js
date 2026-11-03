// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * Pure text wrapping module.
 * Never truncates with ellipsis; wraps lines to given width or char count.
 */

const BREAK_AFTER = /[\s\-/\\_,.]/u;

function pieces(text) {
  const out = [];
  let cur = '';
  for (const ch of text) {
    cur += ch;
    if (BREAK_AFTER.test(ch)) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out;
}

function wrapParagraph(text, maxWidth, measure) {
  const lines = [];
  const fits = (s) => measure(s.trimEnd()) <= maxWidth;
  let line = '';
  for (const piece of pieces(text)) {
    if (fits(line + piece)) { line += piece; continue; }
    if (line.trim()) { lines.push(line.trimEnd()); line = piece.trimStart(); } else line += piece;
    while (!fits(line)) {
      const glyphs = [...line];
      let n = 1;
      while (n < glyphs.length && fits(glyphs.slice(0, n + 1).join(''))) n++;
      const head = glyphs.slice(0, n).join('');
      lines.push(head.trimEnd() || head);
      line = glyphs.slice(n).join('');
    }
  }
  if (line.trimEnd() || !lines.length) lines.push(line.trimEnd());
  return lines;
}

export function wrapToWidth(text, maxWidth, measure) {
  const src = String(text ?? '');
  if (!src) return [''];
  return src.split(/\r?\n/).flatMap(p => wrapParagraph(p, maxWidth, measure));
}

export const charCount = (s) => [...s].length;

export function wrapToChars(text, maxChars) {
  return wrapToWidth(text, Math.max(1, Math.floor(maxChars)), charCount);
}
