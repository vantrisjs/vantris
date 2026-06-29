import type { ColorLevel } from "./capabilities.js";

/**
 * Minimal ANSI styling. A {@link Painter} is built once for a given colour
 * level; every method is a pure `string → string` function that prepends the
 * right SGR codes (or returns the text untouched when colour is disabled or the
 * requested feature isn't supported at this level). No per-call allocation
 * beyond the result string.
 */

const ESC = "\x1b[";

/** An RGB triple, 0–255. */
export type RGB = readonly [number, number, number];

/** Parses `#rgb`/`#rrggbb` to an {@link RGB} triple. */
export function hexToRgb(hex: string): RGB {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Maps an RGB triple to the nearest xterm-256 colour index. */
export function rgbToAnsi256([r, g, b]: RGB): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  return (
    16 +
    36 * Math.round((r / 255) * 5) +
    6 * Math.round((g / 255) * 5) +
    Math.round((b / 255) * 5)
  );
}

/** Maps an xterm-256 index to the nearest basic 16-colour SGR code. */
function ansi256ToBasic(code: number): number {
  if (code >= 232) {
    const level = (code - 232) / 24;
    return level < 0.4 ? 30 : level < 0.75 ? 90 : 97;
  }
  const n = code - 16;
  const r = Math.floor(n / 36) / 5;
  const g = (Math.floor(n / 6) % 6) / 5;
  const b = (n % 6) / 5;
  const max = Math.max(r, g, b);
  if (max < 0.25) return 30;
  const bit = (r >= 0.5 ? 1 : 0) | (g >= 0.5 ? 2 : 0) | (b >= 0.5 ? 4 : 0);
  return (max > 0.8 ? 90 : 30) + bit;
}

export interface Painter {
  readonly level: ColorLevel;
  /** Foreground colour from RGB, adapted to the level. */
  fg(color: RGB): (text: string) => string;
  /** Background colour from RGB, adapted to the level. */
  bg(color: RGB): (text: string) => string;
  bold(text: string): string;
  dim(text: string): string;
  italic(text: string): string;
  underline(text: string): string;
  strikethrough(text: string): string;
}

const identity = (text: string): string => text;

/** Builds a {@link Painter} for the given colour level. */
export function createPainter(level: ColorLevel): Painter {
  if (level === 0) {
    return {
      level,
      fg: () => identity,
      bg: () => identity,
      bold: identity,
      dim: identity,
      italic: identity,
      underline: identity,
      strikethrough: identity,
    };
  }

  const style = (open: number, close: number) => (text: string): string =>
    `${ESC}${open}m${text}${ESC}${close}m`;

  const colorOpen = (rgb: RGB, layer: 38 | 48): string => {
    if (level >= 3) return `${layer};2;${rgb[0]};${rgb[1]};${rgb[2]}`;
    const idx = rgbToAnsi256(rgb);
    if (level >= 2) return `${layer};5;${idx}`;
    const basic = ansi256ToBasic(idx);
    return String(layer === 38 ? basic : basic + 10);
  };

  return {
    level,
    fg: (rgb) => {
      const open = `${ESC}${colorOpen(rgb, 38)}m`;
      return (text) => `${open}${text}${ESC}39m`;
    },
    bg: (rgb) => {
      const open = `${ESC}${colorOpen(rgb, 48)}m`;
      return (text) => `${open}${text}${ESC}49m`;
    },
    bold: style(1, 22),
    dim: style(2, 22),
    italic: style(3, 23),
    underline: style(4, 24),
    strikethrough: style(9, 29),
  };
}
