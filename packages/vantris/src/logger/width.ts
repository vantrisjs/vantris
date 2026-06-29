/**
 * The single source of truth for measuring terminal display width.
 *
 * It strips ANSI styling and OSC 8 hyperlinks, segments the remaining text into
 * grapheme clusters (so combining marks and ZWJ emoji sequences count once),
 * and sums each cluster's display width (CJK/fullwidth/emoji → 2, normal → 1,
 * zero-width → 0). Every layout calculation in the logger goes through this.
 */

// CSI sequences (colours, cursor) + OSC sequences (hyperlinks, BEL- or
// ST-terminated). These are never counted toward width.
const ANSI_RE = /\x1b\[[\d;?]*[A-Za-z]|\x1b\][\s\S]*?(?:\x07|\x1b\\)/g;

/** Removes ANSI styling and OSC 8 link sequences. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Whether a code point is rendered double-width (CJK, fullwidth, emoji). */
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    cp === 0x2329 ||
    cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals … Kangxi
    (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana … CJK compat
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
    (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK compatibility ideographs
    (cp >= 0xfe10 && cp <= 0xfe19) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) || // emoji & pictographs
    (cp >= 0x1f000 && cp <= 0x1f0ff) || // tiles, dominoes, cards
    (cp >= 0x1f100 && cp <= 0x1f1ff) || // enclosed + regional indicators
    (cp >= 0x20000 && cp <= 0x3fffd) // CJK Ext B and beyond
  );
}

/** Display width of a single code point. */
function charWidth(cp: number): number {
  if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) return 0; // control
  if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff) return 0; // zero-width
  return isWide(cp) ? 2 : 1;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * The visible width of `text` once printed to a terminal — the canonical
 * measure used everywhere. ANSI/OSC 8 sequences contribute nothing.
 */
export function displayWidth(text: string): number {
  const stripped = stripAnsi(text);
  if (stripped.length === 0) return 0;

  let width = 0;
  for (const { segment } of segmenter.segment(stripped)) {
    // A grapheme's width is its widest code point: the base character dominates
    // its combining marks (which carry no width of their own).
    let cluster = 0;
    for (const ch of segment) {
      const w = charWidth(ch.codePointAt(0) ?? 0);
      if (w > cluster) cluster = w;
    }
    width += cluster;
  }
  return width;
}
