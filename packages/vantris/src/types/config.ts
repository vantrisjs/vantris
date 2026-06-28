/**
 * Public, user-facing configuration for Vantris.
 *
 * Every field is optional: a project with zero configuration must still build
 * and run using the documented defaults. This interface is intentionally the
 * single extension point through which future versions will grow (plugins,
 * build options, HMR, server tuning, …) without breaking existing configs.
 */
/**
 * Development server options.
 *
 * Extension point for the dev server. v0.2.0 exposes only `port` and `host`;
 * future versions will add HMR, proxy, HTTPS, and middleware hooks here
 * without breaking existing configs.
 */
export interface DevConfig {
  /**
   * Port the dev server listens on.
   *
   * @default 3000
   */
  port?: number;

  /**
   * Host the dev server binds to.
   *
   * @default "localhost"
   */
  host?: string;
}

/**
 * Information about a chunk, passed to a {@link ChunkFileNames} function.
 *
 * This is a Vantris-owned mirror of the bundler's pre-render data: it exposes a
 * stable, curated subset so naming functions never touch Rolldown's types.
 */
export interface ChunkInfo {
  /** Chunk name used in naming patterns. */
  name: string;
  /** Whether this is a static entry chunk. */
  isEntry: boolean;
  /** Whether this is a dynamic-import entry chunk. */
  isDynamicEntry: boolean;
  /** Absolute id of the module this chunk represents, if any. */
  facadeModuleId: string | null;
  /** Absolute ids of the modules included in this chunk. */
  moduleIds: string[];
  /** Names exported by this chunk. */
  exports: string[];
}

/** Information about an asset, passed to an {@link AssetFileNames} function. */
export interface AssetInfo {
  /** Candidate names for the asset. */
  names: string[];
  /** Absolute paths of the asset's original source files. */
  originalFileNames: string[];
}

/** A chunk naming pattern, or a function returning one per chunk. */
export type ChunkFileNames = string | ((chunk: ChunkInfo) => string);

/** An asset naming pattern, or a function returning one per asset. */
export type AssetFileNames = string | ((asset: AssetInfo) => string);

/**
 * Production build options.
 *
 * Extension point for the build system. v0.3.0 exposes a small surface; the
 * interface is shaped to grow (e.g. `target`, `manifest`, `cssCodeSplit`,
 * build hooks/plugins) without breaking existing configs. The underlying
 * bundler (Rolldown) is an internal detail and is never exposed here.
 */
export interface BuildConfig {
  /**
   * Minify the output.
   *
   * @default true
   */
  minify?: boolean;

  /**
   * Source map strategy.
   *
   * - `false` — no source maps
   * - `true` — separate `.map` files
   * - `"inline"` — appended to each file as a data URL
   * - `"hidden"` — separate files without the `//# sourceMappingURL` comment
   *
   * @default false
   */
  sourcemap?: boolean | "inline" | "hidden";

  /**
   * Directory (relative to `outDir`) for built chunks and assets. Used to
   * derive the default `*FileNames` patterns below.
   *
   * @default "assets"
   */
  assetsDir?: string;

  /**
   * Naming pattern for entry chunks — a string with `[name]`, `[hash]`,
   * `[ext]`, `[extname]` placeholders, or a function receiving {@link ChunkInfo}.
   *
   * @default `${assetsDir}/[name]-[hash].js`
   */
  entryFileNames?: ChunkFileNames;

  /**
   * Naming pattern for shared/dynamic chunks (code splitting). String or a
   * function receiving {@link ChunkInfo}.
   *
   * @default `${assetsDir}/[name]-[hash].js`
   */
  chunkFileNames?: ChunkFileNames;

  /**
   * Naming pattern for emitted assets (images, fonts, …). String or a function
   * receiving {@link AssetInfo}.
   *
   * @default `${assetsDir}/[name]-[hash][extname]`
   */
  assetFileNames?: AssetFileNames;

  // ───────────────────────────────────────────────────────────────────────
  // These map to the bundler's output options but are Vantris-owned and
  // Vantris-typed: the bundler (Rolldown) is never exposed, and there is no
  // `rolldownOptions` escape hatch. New output options are added here the same
  // way. Reserved for future versions (declared as a contract, no behaviour):
  //   target?: string | string[];   // output JS target
  //   manifest?: boolean;            // emit a build manifest
  //   plugins?: Plugin[];            // build plugins (v1.x)
  // ───────────────────────────────────────────────────────────────────────
}

export interface Config {
  /**
   * Project root. Resolved relative to the current working directory.
   * The `index.html` entry and every other directory below are resolved
   * relative to this root.
   *
   * @default "."
   */
  root?: string;

  /**
   * Directory containing application source files.
   *
   * @default "./src"
   */
  rootDir?: string;

  /**
   * Directory of static assets served as-is (copied verbatim on build).
   *
   * @default "./public"
   */
  publicDir?: string;

  /**
   * Output directory for production builds.
   *
   * @default "./dist"
   */
  outDir?: string;

  /**
   * Public base path the app is served from. Prefixed to built asset and entry
   * URLs so they resolve correctly when deployed under a sub-path or a CDN.
   * Normalised to always start and end with `/` (URLs keep their trailing `/`).
   *
   * @example "/" (default), "/my-app/", "https://cdn.example.com/assets/"
   * @default "/"
   */
  base?: string;

  /**
   * Development server options. See {@link DevConfig}.
   */
  dev?: DevConfig;

  /**
   * Production build options. See {@link BuildConfig}.
   */
  build?: BuildConfig;

  // ───────────────────────────────────────────────────────────────────────
  // Reserved for future versions. Declared here as a contract so consumers
  // and tooling can already anticipate the shape, without any behaviour yet.
  //
  //   plugins?: Plugin[];
  //   resolve?: ResolveOptions; // transforms / aliasing (esbuild)
  // ───────────────────────────────────────────────────────────────────────
}

/**
 * A factory form of {@link Config}. Supporting a function (sync or async)
 * lets configs react to environment/CLI input in later versions without an
 * API change.
 */
export type ConfigFn = () =>
  | Config
  | Promise<Config>;

/** Anything accepted by {@link defineConfig}. */
export type ConfigInput = Config | ConfigFn;
