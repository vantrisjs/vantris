import type { Theme } from "./theme.js";
import { displayWidth } from "./width.js";

export { stripAnsi, displayWidth } from "./width.js";
/** @deprecated alias of {@link displayWidth} — kept for back-compat. */
export { displayWidth as visibleWidth } from "./width.js";

/** Formats a byte count as a short human string (e.g. `1.2 kB`). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unit]}`;
}

interface BoxChars {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
}

/** Border styles; all produce a consistent, fully-aligned frame. */
export type BorderStyle = "round" | "sharp" | "double" | "thick" | "ascii";

const BORDERS: Record<BorderStyle, BoxChars> = {
  round: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
  sharp: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
  double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
  thick: { tl: "┏", tr: "┓", bl: "┗", br: "┛", h: "━", v: "┃" },
  ascii: { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" },
};

export interface BoxOptions {
  theme: Theme;
  /** Whether the terminal renders Unicode box-drawing characters. */
  unicode: boolean;
  /** Optional title shown in the top border. */
  title?: string;
  /**
   * Inner padding. A number applies to all sides; an object sets horizontal
   * (`x`, columns) and vertical (`y`, blank rows) independently. @default 1
   */
  padding?: number | { x?: number; y?: number };
  /** Content alignment. @default "left" */
  align?: "left" | "center" | "right";
  /** Border style. @default unicode ? "round" : "ascii" */
  border?: BorderStyle;
  /** Minimum inner content width (the box expands if content is wider). */
  width?: number;
}

/**
 * Renders `lines` inside a box whose every line is **exactly** the same visible
 * width. The full layout (widths, padding, title fill) is computed first — from
 * {@link displayWidth}, never raw string length — then borders are generated, so
 * ANSI colours, OSC 8 links, emoji, and CJK never break the frame.
 */
export function box(lines: readonly string[], options: BoxOptions): string {
  const { theme } = options;
  const chars =
    BORDERS[options.border ?? (options.unicode ? "round" : "ascii")];
  const p = options.padding ?? 1;
  const padX = Math.max(0, typeof p === "number" ? p : p.x ?? 1);
  const padY = Math.max(0, typeof p === "number" ? p : p.y ?? 0);
  const align = options.align ?? "left";
  const dim = theme.muted;
  const hasTitle = Boolean(options.title);

  // 1. Measure every line once and derive the inner content width.
  const measured = lines.map((text) => ({ text, width: displayWidth(text) }));
  const titleWidth = hasTitle ? displayWidth(options.title!) : 0;
  const content = measured.reduce((max, line) => Math.max(max, line.width), 0);
  const inner = Math.max(
    content,
    options.width ?? 0,
    titleWidth > 0 ? titleWidth + 2 : 0,
  );
  const full = inner + padX * 2; // interior width between the vertical borders

  // 2. Generate borders from the finished layout — same width everywhere.
  let top: string;
  if (hasTitle) {
    const head = `${chars.h} ${theme.bold(options.title!)} `; // h + space + title + space
    const fill = full - (titleWidth + 3);
    top = dim(`${chars.tl}${head}${chars.h.repeat(Math.max(0, fill))}${chars.tr}`);
  } else {
    top = dim(`${chars.tl}${chars.h.repeat(full)}${chars.tr}`);
  }
  const bottom = dim(`${chars.bl}${chars.h.repeat(full)}${chars.br}`);

  const margin = " ".repeat(padX);
  const blank = `${dim(chars.v)}${" ".repeat(full)}${dim(chars.v)}`;
  const content2 = measured.map(({ text, width }) => {
    const extra = inner - width;
    const left = align === "right" ? extra : align === "center" ? extra >> 1 : 0;
    const right = extra - left;
    return `${dim(chars.v)}${margin}${" ".repeat(left)}${text}${" ".repeat(right)}${margin}${dim(chars.v)}`;
  });

  const vpad = padY > 0 ? Array<string>(padY).fill(blank) : [];
  return [top, ...vpad, ...content2, ...vpad, bottom].join("\n");
}

/** Renders `[label, value]` rows as two aligned columns (width-aware). */
export function table(
  rows: ReadonlyArray<readonly [string, string]>,
  theme: Theme,
): string {
  const labelWidth = rows.reduce((m, [label]) => Math.max(m, displayWidth(label)), 0);
  return rows
    .map(([label, value]) => {
      const padding = " ".repeat(labelWidth - displayWidth(label));
      return `  ${theme.muted(label)}${padding}  ${value}`;
    })
    .join("\n");
}

/** A dim horizontal rule spanning `width` columns. */
export function separator(theme: Theme, unicode: boolean, width = 48): string {
  return theme.muted((unicode ? "─" : "-").repeat(width));
}

/** A brand-accented section title. */
export function title(text: string, theme: Theme): string {
  return theme.brand(theme.bold(text));
}

/**
 * Renders an error as a clean, modern block: a red title, the message with a
 * clear hierarchy, and an optional hint — no overwhelming stack trace.
 */
export function formatError(
  name: string,
  message: string,
  theme: Theme,
  icon: string,
  hint?: string,
): string {
  const lines = [
    "",
    `${theme.error(icon)} ${theme.error(theme.bold(name))}`,
    ...message.split("\n").map((line) => `  ${line}`),
  ];
  if (hint) lines.push("", `  ${theme.muted(hint)}`);
  lines.push("");
  return lines.join("\n");
}
