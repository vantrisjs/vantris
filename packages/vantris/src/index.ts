/**
 * Vantris — public programmatic API.
 *
 * The CLI (`bin: vantris`) is the primary entry point, but everything it relies
 * on is also exported here so Vantris can be embedded in custom tooling.
 */

// Configuration
export { defineConfig, loadConfig, resolveConfig } from "./config/index.js";

// HTML entry detection
export { detectHtmlEntry, parseHtml } from "./html/index.js";

// Context & services
export { createContext, createLogger } from "./shared/index.js";
export {
  VantrisError,
  ConfigError,
  HtmlEntryError,
  NotImplementedError,
  isVantrisError,
} from "./shared/errors.js";
export { VERSION } from "./shared/constants.js";

// Command registry & runner (for programmatic invocation)
export { commands } from "./commands/index.js";
export { run } from "./cli/run.js";

// Public types
export type {
  Config,
  ConfigFn,
  ConfigInput,
  ResolvedConfig,
  ResolvedPaths,
  Logger,
  HtmlEntry,
  Context,
  Command,
} from "./types/index.js";
