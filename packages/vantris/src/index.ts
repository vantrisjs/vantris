/**
 * Vantris — public programmatic API.
 *
 * The CLI (`bin: vantris`) is the primary entry point, but everything it relies
 * on is also exported here so Vantris can be embedded in custom tooling.
 */

// Configuration
export { defineConfig, loadConfig, resolveConfig } from "./config/index.js";

// HTML pipeline
export {
  detectHtmlEntry,
  parseHtml,
  injectDevClient,
  DEV_CLIENT_SCRIPT,
} from "./html/index.js";

// Dev server
export { startDevServer } from "./server/index.js";
export type { DevServerOptions, DevServerHandle } from "./server/index.js";

// Context & services
export { createContext, createLogger, createWatcher } from "./shared/index.js";
export type { Watcher, WatcherOptions, WatchEvent } from "./shared/index.js";
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
  DevConfig,
  ResolvedConfig,
  ResolvedDevConfig,
  ResolvedPaths,
  Logger,
  HtmlEntry,
  HtmlModuleScript,
  Context,
  Command,
} from "./types/index.js";
