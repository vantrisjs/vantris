/**
 * Vantris — public programmatic API.
 *
 * The CLI (`bin: vantris`) is the primary entry point, but everything it relies
 * on is also exported here so Vantris can be embedded in custom tooling.
 */

// Configuration
export {
  defineConfig,
  loadConfig,
  resolveConfig,
  validateConfig,
} from "./config/index.js";

// Environment variables
export { loadEnv, parseEnv, clientEnv, envDefine, ENV_PREFIX } from "./env/index.js";
export type { ClientEnv } from "./env/index.js";

// Module resolver
export { createResolver } from "./resolver/index.js";
export type { Resolver } from "./resolver/index.js";

// HTML pipeline
export {
  detectHtmlEntry,
  parseHtml,
  injectDevClient,
  DEV_CLIENT_SCRIPT,
} from "./html/index.js";

// Dev server
export { createDevServer, startDevServer } from "./server/index.js";
export type { DevServerOptions, DevServerHandle } from "./server/index.js";
export { getRuntime } from "./runtime.js";
export type { Runtime } from "./runtime.js";

// Build system
export { runBuild } from "./build/index.js";
export type { BuildOptions, BuildResult } from "./build/index.js";

// Preview server
export { startPreviewServer } from "./preview/index.js";
export type {
  PreviewServerOptions,
  PreviewServerHandle,
} from "./preview/index.js";

// Internal cache
export { createCache, cacheForContext, cacheKey } from "./cache/index.js";
export type { Cache, CacheOptions } from "./cache/index.js";

// Context & services
export { createContext, createLogger, createWatcher } from "./shared/index.js";
export type { Watcher, WatcherOptions, WatchEvent } from "./shared/index.js";
export {
  VantrisError,
  ConfigError,
  HtmlEntryError,
  BuildError,
  ServerError,
  PreviewError,
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
  BuildConfig,
  PreviewConfig,
  ResolveConfig,
  ChunkInfo,
  AssetInfo,
  ChunkFileNames,
  AssetFileNames,
  LibConfig,
  LibFormat,
  DefineValue,
  ServerConfig,
  HttpsConfig,
  ProxyOptions,
  CorsOptions,
  ResolvedConfig,
  ResolvedDevConfig,
  ResolvedServerConfig,
  ResolvedProxyRule,
  ResolvedCors,
  ResolvedBuildConfig,
  ResolvedLibConfig,
  ResolvedPreviewConfig,
  ResolvedResolveConfig,
  AliasEntry,
  ResolvedPaths,
  Logger,
  HtmlEntry,
  HtmlModuleScript,
  Context,
  Command,
} from "./types/index.js";
