import type {
  AssetFileNames,
  ChunkFileNames,
  Config,
  LibFormat,
} from "./config.js";
import type { ResolvedPaths } from "./paths.js";

/** Dev-server options after defaults have been applied (no optionals). */
export interface ResolvedDevConfig {
  readonly port: number;
  readonly host: string;
}

/** A normalised proxy rule. */
export interface ResolvedProxyRule {
  /** Request-path prefix that activates this rule. */
  readonly context: string;
  /** Target origin. */
  readonly target: string;
  readonly changeOrigin: boolean;
  readonly secure: boolean;
  /** Optional path rewrite before forwarding. */
  readonly rewrite: ((path: string) => string) | null;
}

/** Normalised CORS options (present only when CORS is enabled). */
export interface ResolvedCors {
  readonly origin: string | string[] | boolean;
  readonly methods: readonly string[];
  readonly headers: readonly string[];
  readonly credentials: boolean;
}

/** Dev-server network options after defaults/normalisation. */
export interface ResolvedServerConfig {
  /** `false`, `true` (generate a self-signed cert), or explicit cert material. */
  readonly https: boolean | { readonly cert: string; readonly key: string };
  /** Proxy rules, longest-`context`-first. */
  readonly proxy: readonly ResolvedProxyRule[];
  /** CORS options, or `null` when disabled. */
  readonly cors: ResolvedCors | null;
  /** Dev-server base path, normalised to start and end with `/`. */
  readonly base: string;
  /** Whether unmatched non-file routes fall back to `index.html`. */
  readonly spaFallback: boolean;
}

/** Preview-server options after defaults have been applied (no optionals). */
export interface ResolvedPreviewConfig {
  readonly port: number;
  readonly host: string;
  readonly open: boolean;
}

/** A normalised alias: replace `find` (prefix) with the absolute `replacement`. */
export interface AliasEntry {
  readonly find: string;
  readonly replacement: string;
}

/** Resolution options after defaults/normalisation. */
export interface ResolvedResolveConfig {
  /** Alias entries, sorted longest-`find`-first. Replacements are absolute. */
  readonly alias: readonly AliasEntry[];
  /** Extensions tried when resolving an extensionless specifier. */
  readonly extensions: readonly string[];
}

/** Library-mode options after defaults/normalisation (entry made absolute). */
export interface ResolvedLibConfig {
  /** Absolute path of the entry module. */
  readonly entry: string;
  /** Global name for the `iife` format, or `null`. */
  readonly name: string | null;
  /** Formats to emit. */
  readonly formats: readonly LibFormat[];
  /** Output base name (no extension), or a function of the format. */
  readonly fileName: string | ((format: LibFormat) => string);
}

/** Build options after defaults have been applied (no optionals). */
export interface ResolvedBuildConfig {
  readonly minify: boolean;
  readonly sourcemap: boolean | "inline" | "hidden";
  readonly assetsDir: string;
  readonly entryFileNames: ChunkFileNames;
  readonly chunkFileNames: ChunkFileNames;
  readonly assetFileNames: AssetFileNames;
  /** Whether to empty `outDir` before building. */
  readonly emptyOutDir: boolean;
  /** Library-mode options, or `null` for an HTML application build. */
  readonly lib: ResolvedLibConfig | null;
}

/**
 * A {@link Config} after defaults have been applied and paths resolved.
 *
 * This is what the rest of the system consumes. Keeping it separate from the
 * user-facing {@link Config} means defaults and resolution rules can evolve
 * without forcing optionality onto every internal consumer.
 */
export interface ResolvedConfig {
  /** The raw configuration as authored by the user (post-normalisation). */
  readonly raw: Config;
  /** Absolute paths derived from the configuration. */
  readonly paths: ResolvedPaths;
  /** Public base path, normalised to start and end with `/`. */
  readonly base: string;
  /** Resolved dev-server options. */
  readonly dev: ResolvedDevConfig;
  /** Resolved dev-server network options. */
  readonly server: ResolvedServerConfig;
  /** Resolved build options. */
  readonly build: ResolvedBuildConfig;
  /** Resolved preview-server options. */
  readonly preview: ResolvedPreviewConfig;
  /** Resolved module-resolution options. */
  readonly resolve: ResolvedResolveConfig;
  /**
   * Global constant replacements, pre-serialised to JSON literals (token →
   * literal source) ready for the dev transpiler and the bundler.
   */
  readonly define: Readonly<Record<string, string>>;
  /** Absolute path of the internal cache directory (`node_modules/.vantris`). */
  readonly cacheDir: string;
  /** Absolute path of the config file that was loaded, if any. */
  readonly configFile: string | null;
}
