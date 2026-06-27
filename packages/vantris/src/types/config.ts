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
   * Development server options. See {@link DevConfig}.
   */
  dev?: DevConfig;

  // ───────────────────────────────────────────────────────────────────────
  // Reserved for future versions. Declared here as a contract so consumers
  // and tooling can already anticipate the shape, without any behaviour yet.
  //
  //   plugins?: Plugin[];
  //   build?: BuildOptions;     // build system (Rolldown)
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
