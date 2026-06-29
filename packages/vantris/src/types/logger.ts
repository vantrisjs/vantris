/**
 * The logging contract injected throughout Vantris.
 *
 * The level methods (`info`/`success`/`warn`/`error`/`debug`) **write** a styled
 * line; the inline helpers (`link`/`dim`/`color`) **return** a styled string for
 * composition; and the block helpers (`box`/`table`/`separator`/`title`) write
 * richer structures. All styling adapts automatically to the terminal.
 */
export interface Logger {
  /** An information line. */
  info(message: string): void;
  /** A success line. */
  success(message: string): void;
  /** A warning line. */
  warn(message: string): void;
  /** An error line. */
  error(message: string): void;
  /** A verbose diagnostic line (shown only at debug level). */
  debug(message: string): void;
  /** Writes a raw line at info level — no icon (for structured output). */
  print(text: string): void;

  /**
   * An inline hyperlink. With OSC 8 support only the (styled) label shows and is
   * clickable; otherwise it falls back to `label (url)`. Returns the string.
   */
  link(label: string, url: string): string;
  /** Dim text. Returns the styled string. */
  dim(text: string): string;
  /** Colour text by hex (e.g. `"#a78bfa"`). Returns the styled string. */
  color(text: string, hex: string): string;

  /** A boxed block (optionally titled, padded, and aligned). */
  box(
    lines: readonly string[],
    options?: {
      title?: string;
      /** A number pads all sides; `{ x, y }` sets columns and blank rows. */
      padding?: number | { x?: number; y?: number };
      align?: "left" | "center" | "right";
    },
  ): void;
  /** Two aligned `[label, value]` columns. */
  table(rows: ReadonlyArray<readonly [string, string]>): void;
  /** A horizontal separator rule. */
  separator(): void;
  /** A brand-accented section title. */
  title(text: string): void;
}
