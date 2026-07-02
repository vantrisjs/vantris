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

/** Explicit TLS certificate material for {@link ServerConfig.https}. */
export interface HttpsConfig {
  /** PEM certificate (contents or a path resolved against `root`). */
  cert: string;
  /** PEM private key (contents or a path resolved against `root`). */
  key: string;
}

/** Options for proxying matched requests to another origin. */
export interface ProxyOptions {
  /** Target origin, e.g. `"http://localhost:8080"`. */
  target: string;
  /** Rewrite the `Host` header to the target's. @default true */
  changeOrigin?: boolean;
  /** Rewrite the request path before forwarding (e.g. strip a prefix). */
  rewrite?: (path: string) => string;
  /** Verify TLS certificates for an `https` target. @default true */
  secure?: boolean;
}

/** Cross-Origin Resource Sharing options. */
export interface CorsOptions {
  /**
   * Allowed origin(s). `true` reflects the request's `Origin`.
   * @default true
   */
  origin?: string | string[] | boolean;
  /** Allowed methods. @default ["GET","HEAD","PUT","PATCH","POST","DELETE"] */
  methods?: string[];
  /** Allowed request headers (echoed to `Access-Control-Allow-Headers`). */
  headers?: string[];
  /** Allow credentials (`Access-Control-Allow-Credentials`). @default false */
  credentials?: boolean;
}

/**
 * Dev-server network options (v0.9.0).
 *
 * `host`/`port` intentionally stay in {@link DevConfig}; this covers the
 * networking layer — HTTPS, proxying, CORS, base path, and SPA fallback.
 */
export interface ServerConfig {
  /**
   * Serve over HTTPS. `true` generates a self-signed **development**
   * certificate on the fly; pass `{ cert, key }` to use your own.
   *
   * @default false
   */
  https?: boolean | HttpsConfig;

  /**
   * Proxy rules mapping a request-path prefix to a target origin (a string) or
   * {@link ProxyOptions}.
   *
   * @example { "/api": "http://localhost:8080" }
   */
  proxy?: Record<string, string | ProxyOptions>;

  /**
   * Enable CORS. `true` applies permissive defaults; an object customises it.
   * Off by default.
   *
   * @default false
   */
  cors?: boolean | CorsOptions;

  /**
   * Sub-path the dev server is mounted under. Defaults to the top-level
   * {@link Config.base}. Injected scripts and asset URLs respect it.
   */
  base?: string;

  /**
   * History-API fallback: an unmatched, non-file route serves `index.html`
   * (so client-side routing works on refresh).
   *
   * @default true
   */
  spaFallback?: boolean;
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

/** Output formats Vantris can emit in library mode. */
export type LibFormat = "esm" | "cjs" | "iife";

/**
 * Library-mode build options.
 *
 * When `build.lib` is set, Vantris bundles a single entry module into one or
 * more distribution formats (instead of building an HTML application). The
 * shape is intentionally small and extensible — new formats can be added to
 * {@link LibFormat} without an API change.
 */
export interface LibConfig {
  /** Entry module to bundle. Relative to `root`, or absolute. */
  entry: string;
  /**
   * Global variable name the library is exposed as. **Required** for the
   * `iife` format (a browser global needs a name); ignored by `esm`/`cjs`.
   */
  name?: string;
  /**
   * Formats to emit, each producing its own file in a single build.
   *
   * @default ["esm", "cjs"]
   */
  formats?: LibFormat[];
  /**
   * Output file name (without extension), or a function of the format. The
   * extension is derived per format (`.mjs`, `.cjs`, `.iife.js`).
   *
   * @default the entry file's base name
   */
  fileName?: string | ((format: LibFormat) => string);
}

/**
 * A value usable in {@link Config.define}. Each value is serialised to a JSON
 * literal and substituted verbatim into the code at dev and build time.
 */
export type DefineValue = string | number | boolean;

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

  /**
   * Empty the output directory before building. The clean is guarded so it can
   * never remove anything outside `outDir`.
   *
   * @default true
   */
  emptyOutDir?: boolean;

  /**
   * Build as a library instead of an HTML application. See {@link LibConfig}.
   * When set, the HTML pipeline is skipped and the entry is emitted in each
   * requested format.
   */
  lib?: LibConfig;

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

/**
 * Preview-server options.
 *
 * The preview server (`vantris preview`) serves a finished production build
 * from `outDir`, mirroring production as closely as possible. It performs no
 * compilation.
 */
export interface PreviewConfig {
  /**
   * Port the preview server listens on.
   *
   * @default 4173
   */
  port?: number;

  /**
   * Host the preview server binds to.
   *
   * @default "localhost"
   */
  host?: string;

  /**
   * Open the app in the default browser once the server is ready.
   *
   * @default false
   */
  open?: boolean;
}

/**
 * Module-resolution options, shared by dev, build, HTML, and CSS.
 */
export interface ResolveConfig {
  /**
   * Import aliases. Each key is matched as a prefix and replaced with a path
   * (relative to `root`, or absolute). Applied everywhere a specifier is
   * resolved.
   *
   * @example { "@": "./src", "~": "./shared" }
   */
  alias?: Record<string, string>;

  // Reserved for future versions (no behaviour yet):
  //   extensions?: string[];   // override the default resolution extensions
  //   conditions?: string[];   // export-map conditions
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
   * Development server options (host/port). See {@link DevConfig}.
   */
  dev?: DevConfig;

  /**
   * Dev-server network options (HTTPS, proxy, CORS, base, SPA fallback). See
   * {@link ServerConfig}.
   */
  server?: ServerConfig;

  /**
   * Production build options. See {@link BuildConfig}.
   */
  build?: BuildConfig;

  /**
   * Preview server options. See {@link PreviewConfig}.
   */
  preview?: PreviewConfig;

  /**
   * Module-resolution options (aliases, …). See {@link ResolveConfig}.
   */
  resolve?: ResolveConfig;

  /**
   * Global constant replacements. Each key is replaced — verbatim, as a JSON
   * literal — wherever it appears in your code, in both development and build.
   *
   * Use it for compile-time flags and metadata that should be inlined (and
   * tree-shaken) rather than read at runtime.
   *
   * @example { __DEV__: true, __APP_VERSION__: "1.0.0" }
   */
  define?: Record<string, DefineValue>;

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
