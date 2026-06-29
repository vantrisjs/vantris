/**
 * Terminal capability detection.
 *
 * Inspired by how tools like Chalk/supports-color probe the environment, but a
 * focused, dependency-free implementation. Results are cached per stream so the
 * (env-reading) detection runs at most once.
 */

/** Colour support: 0 none · 1 basic (16) · 2 extended (256) · 3 truecolor. */
export type ColorLevel = 0 | 1 | 2 | 3;

export interface TerminalCapabilities {
  /** Whether the stream is an interactive terminal. */
  readonly isTTY: boolean;
  /** Detected colour level. */
  readonly colorLevel: ColorLevel;
  /** Whether OSC 8 hyperlinks are supported. */
  readonly hyperlinks: boolean;
  /** Whether the terminal renders Unicode box-drawing/symbols well. */
  readonly unicode: boolean;
  /** Whether running in a CI environment. */
  readonly isCI: boolean;
}

const cache = new WeakMap<object, TerminalCapabilities>();

/** Parses `FORCE_COLOR` into a level, or `undefined` when unset. */
function forcedColorLevel(env: NodeJS.ProcessEnv): ColorLevel | undefined {
  const value = env["FORCE_COLOR"];
  if (value === undefined) return undefined;
  if (value === "" || value === "true") return 1;
  if (value === "false") return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 1 : (Math.min(3, Math.max(0, n)) as ColorLevel);
}

function detectColorLevel(
  stream: { isTTY?: boolean },
  env: NodeJS.ProcessEnv,
  isCI: boolean,
): ColorLevel {
  const forced = forcedColorLevel(env);
  if (forced !== undefined) return forced;
  if ("NO_COLOR" in env || env["TERM"] === "dumb") return 0;
  if (!stream.isTTY && !isCI) return 0;

  if (/-?24bit|truecolor/i.test(env["COLORTERM"] ?? "")) return 3;
  if (env["TERM_PROGRAM"] === "iTerm.app" || env["TERM_PROGRAM"] === "vscode") return 3;
  if (env["WT_SESSION"]) return 3; // Windows Terminal
  if (/-256(color)?/i.test(env["TERM"] ?? "")) return 2;
  if (isCI) return 1;
  if (/color|ansi|cygwin|linux|xterm|screen|vt100/i.test(env["TERM"] ?? "")) return 1;
  return stream.isTTY ? 1 : 0;
}

function detectHyperlinks(
  stream: { isTTY?: boolean },
  env: NodeJS.ProcessEnv,
  isCI: boolean,
): boolean {
  if (!stream.isTTY || isCI) return false;
  if (env["TERM_PROGRAM"] === "iTerm.app" || env["TERM_PROGRAM"] === "vscode") return true;
  if (env["TERM_PROGRAM"] === "Hyper" || env["TERM_PROGRAM"] === "WezTerm") return true;
  if (env["WT_SESSION"] || env["KITTY_WINDOW_ID"]) return true;
  const vte = Number(env["VTE_VERSION"]);
  return Number.isFinite(vte) && vte >= 5000;
}

function detectUnicode(env: NodeJS.ProcessEnv): boolean {
  if (process.platform !== "win32") {
    return /UTF-?8$/i.test(env["LC_ALL"] || env["LC_CTYPE"] || env["LANG"] || "UTF-8");
  }
  return Boolean(env["WT_SESSION"] || env["TERM_PROGRAM"] || env["TERM"]);
}

/**
 * Detects the capabilities of an output stream (defaults to stdout). The result
 * is cached, so repeated calls are free.
 */
export function detectCapabilities(
  stream: { isTTY?: boolean } = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
): TerminalCapabilities {
  const cached = cache.get(stream);
  if (cached) return cached;

  const isCI = Boolean(env["CI"]);
  const capabilities: TerminalCapabilities = {
    isTTY: Boolean(stream.isTTY),
    isCI,
    colorLevel: detectColorLevel(stream, env, isCI),
    hyperlinks: detectHyperlinks(stream, env, isCI),
    unicode: detectUnicode(env),
  };

  cache.set(stream, capabilities);
  return capabilities;
}
