import { createPainter, type Painter, type RGB } from "./ansi.js";
import type { ColorLevel } from "./capabilities.js";

/**
 * Vantris's visual identity: a small, fixed palette of semantic styles built
 * **once** per colour level. Using precomputed closures (rather than parsing a
 * colour per call) keeps the hot logging path allocation-free.
 */
export interface Theme {
  readonly painter: Painter;
  /** Brand accent (violet) — banners, titles, the product name. */
  brand(text: string): string;
  info(text: string): string;
  success(text: string): string;
  warn(text: string): string;
  error(text: string): string;
  /** Muted/secondary text. */
  muted(text: string): string;
  dim(text: string): string;
  bold(text: string): string;
  /** A styled, underlined link label. */
  link(text: string): string;
}

const BRAND: RGB = [167, 139, 250]; // violet
const CYAN: RGB = [56, 189, 248];
const GREEN: RGB = [74, 222, 128];
const YELLOW: RGB = [250, 204, 21];
const RED: RGB = [248, 113, 113];
const GRAY: RGB = [148, 163, 184];

/** Builds the {@link Theme} for a colour level. */
export function createTheme(level: ColorLevel): Theme {
  const painter = createPainter(level);
  const brand = painter.fg(BRAND);
  const cyan = painter.fg(CYAN);
  const green = painter.fg(GREEN);
  const yellow = painter.fg(YELLOW);
  const red = painter.fg(RED);
  const gray = painter.fg(GRAY);

  return {
    painter,
    brand,
    info: cyan,
    success: green,
    warn: yellow,
    error: red,
    muted: gray,
    dim: painter.dim,
    bold: painter.bold,
    link: (text) => painter.underline(cyan(text)),
  };
}
