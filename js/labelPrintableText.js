// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * Characters standard PDF / print engines cannot encode cleanly, and clean ASCII substitutes.
 */
const UNPRINTABLE = {
  '→': '->', '⇒': '=>', '←': '<-', '↔': '<->', '➔': '->',
  '⚠': '!', '✓': 'v', '✗': 'x',
  '≤': '<=', '≥': '>=', '≠': '!=',
  '‐': '-', '‑': '-', '‒': '-', '−': '-',
};

const WINANSI_EXTRAS = new Set('…’‘“”—–€™š›œžŸƒ†‡ˆ‰Š‹Œ‚„');

export function toPrintableText(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    if (UNPRINTABLE[ch] !== undefined) { out += UNPRINTABLE[ch]; continue; }
    if (ch.codePointAt(0) <= 0xff || WINANSI_EXTRAS.has(ch)) { out += ch; continue; }
  }
  return out;
}
