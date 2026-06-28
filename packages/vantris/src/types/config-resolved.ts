import type { AssetFileNames, ChunkFileNames, Config } from "./config.js";
import type { ResolvedPaths } from "./paths.js";

/** Dev-server options after defaults have been applied (no optionals). */
export interface ResolvedDevConfig {
  readonly port: number;
  readonly host: string;
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

/** Build options after defaults have been applied (no optionals). */
export interface ResolvedBuildConfig {
  readonly minify: boolean;
  readonly sourcemap: boolean | "inline" | "hidden";
  readonly assetsDir: string;
  readonly entryFileNames: ChunkFileNames;
  readonly chunkFileNames: ChunkFileNames;
  readonly assetFileNames: AssetFileNames;
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
  /** Resolved build options. */
  readonly build: ResolvedBuildConfig;
  /** Resolved preview-server options. */
  readonly preview: ResolvedPreviewConfig;
  /** Resolved module-resolution options. */
  readonly resolve: ResolvedResolveConfig;
  /** Absolute path of the config file that was loaded, if any. */
  readonly configFile: string | null;
}
