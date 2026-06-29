import type { Logger } from "../types/logger.js";
import { isVantrisError } from "../shared/errors.js";
import { hexToRgb } from "./ansi.js";
import {
  detectCapabilities,
  type TerminalCapabilities,
} from "./capabilities.js";
import { createTheme } from "./theme.js";
import { autolink, renderLink } from "./links.js";
import { box, formatError, separator, table, title } from "./format.js";

export { detectCapabilities } from "./capabilities.js";
export type { TerminalCapabilities, ColorLevel } from "./capabilities.js";
export { formatBytes } from "./format.js";

/** Log levels, from least to most verbose. */
export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const SEVERITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const UNICODE_ICONS = { info: "ℹ", success: "✔", warn: "▲", error: "✖", debug: "·" };
const ASCII_ICONS = { info: "i", success: "+", warn: "!", error: "x", debug: "." };

export interface LoggerOptions {
  /** Minimum level to print. @default "info" */
  level?: LogLevel;
  /** Shorthand for `level: "debug"`. */
  verbose?: boolean;
  /** Force colour on/off; auto-detected from the terminal by default. */
  color?: boolean;
  /** Output sink; defaults to the console. */
  sink?: Pick<Console, "log" | "warn" | "error">;
  /** Capability override (mainly for tests). */
  capabilities?: TerminalCapabilities;
}

/**
 * Creates Vantris's logger: a fast, dependency-free, terminal-aware logger.
 *
 * Capabilities are detected once, the theme is precomputed for the colour
 * level, and the level filter and link auto-detection live on the hot path with
 * minimal allocation. There is no `[vantris]` prefix — the product name only
 * appears in banners, versions, and fatal errors.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? (options.verbose ? "debug" : "info");
  const threshold = SEVERITY[level];
  const sink = options.sink ?? console;
  const caps = options.capabilities ?? detectCapabilities();
  const colorLevel = (options.color === false ? 0 : options.color === true ? Math.max(1, caps.colorLevel) : caps.colorLevel) as TerminalCapabilities["colorLevel"];
  const theme = createTheme(colorLevel);
  const icons = caps.unicode ? UNICODE_ICONS : ASCII_ICONS;
  const links = caps.hyperlinks;

  const on = (lvl: keyof typeof SEVERITY): boolean => SEVERITY[lvl] <= threshold;
  const emit = (
    out: (line: string) => void,
    icon: string,
    paint: (text: string) => string,
    message: string,
  ): void => {
    out(`${paint(icon)} ${autolink(message, theme, links)}`);
  };

  return {
    info(message) {
      if (on("info")) emit((l) => sink.log(l), icons.info, theme.info, message);
    },
    success(message) {
      if (on("info")) emit((l) => sink.log(l), icons.success, theme.success, message);
    },
    warn(message) {
      if (on("warn")) emit((l) => sink.warn(l), icons.warn, theme.warn, message);
    },
    error(message) {
      if (on("error")) emit((l) => sink.error(l), icons.error, theme.error, message);
    },
    debug(message) {
      if (on("debug")) sink.log(theme.dim(`${icons.debug} ${message}`));
    },
    print(text) {
      if (on("info")) sink.log(text);
    },

    link(label, url) {
      return renderLink(label, url, theme, links);
    },
    dim(text) {
      return theme.dim(text);
    },
    color(text, hex) {
      return theme.painter.fg(hexToRgb(hex))(text);
    },

    box(lines, opts) {
      if (!on("info")) return;
      sink.log(
        box(lines, {
          theme,
          unicode: caps.unicode,
          ...(opts?.title ? { title: opts.title } : {}),
          ...(opts?.padding !== undefined ? { padding: opts.padding } : {}),
          ...(opts?.align ? { align: opts.align } : {}),
        }),
      );
    },
    table(rows) {
      if (on("info")) sink.log(table(rows, theme));
    },
    separator() {
      if (on("info")) sink.log(separator(theme, caps.unicode));
    },
    title(text) {
      if (on("info")) sink.log(title(text, theme));
    },
  };
}

/**
 * Renders an unhandled error as a modern, readable block for the CLI — a red
 * title, the message, and a hint — instead of a raw stack trace.
 */
export function renderError(error: unknown, verbose = false): string {
  const caps = detectCapabilities(process.stderr);
  const theme = createTheme(caps.colorLevel);
  const icon = caps.unicode ? "✖" : "x";

  if (isVantrisError(error)) {
    return formatError(error.name, error.message, theme, icon);
  }

  const err = error instanceof Error ? error : new Error(String(error));
  const hint = verbose ? undefined : "Re-run with --verbose for the full stack.";
  let block = formatError("UnexpectedError", err.message, theme, icon, hint);
  if (verbose && err.stack) block += `${theme.dim(err.stack)}\n`;
  return block;
}
