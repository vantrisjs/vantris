import type { Config } from "../types/config.js";
import type {
  AliasEntry,
  ResolvedBuildConfig,
  ResolvedConfig,
  ResolvedDevConfig,
  ResolvedPreviewConfig,
  ResolvedResolveConfig,
} from "../types/config-resolved.js";
import type { ResolvedPaths } from "../types/paths.js";
import {
  BUILD_DEFAULTS,
  DEFAULTS,
  DEV_DEFAULTS,
  PREVIEW_DEFAULTS,
  RESOLVE_EXTENSIONS,
} from "../shared/constants.js";
import { resolveFrom } from "../utils/paths.js";

/**
 * Applies defaults to a raw {@link Config} and resolves every directory to an
 * absolute path. This is the single source of truth for default values and
 * path resolution — no other module should re-derive these.
 *
 * @param raw        User configuration (after loading; may be empty).
 * @param cwd        Working directory the invocation started from.
 * @param configFile Absolute path of the loaded config file, or `null`.
 */
export function resolveConfig(
  raw: Config,
  cwd: string,
  configFile: string | null = null,
): ResolvedConfig {
  const root = resolveFrom(cwd, raw.root ?? DEFAULTS.root);

  const paths: ResolvedPaths = {
    root,
    rootDir: resolveFrom(root, raw.rootDir ?? DEFAULTS.rootDir),
    publicDir: resolveFrom(root, raw.publicDir ?? DEFAULTS.publicDir),
    outDir: resolveFrom(root, raw.outDir ?? DEFAULTS.outDir),
  };

  const base = normalizeBase(raw.base ?? "/");

  const dev: ResolvedDevConfig = {
    port: raw.dev?.port ?? DEV_DEFAULTS.port,
    host: raw.dev?.host ?? DEV_DEFAULTS.host,
  };

  const assetsDir = raw.build?.assetsDir ?? BUILD_DEFAULTS.assetsDir;
  const build: ResolvedBuildConfig = {
    minify: raw.build?.minify ?? BUILD_DEFAULTS.minify,
    sourcemap: raw.build?.sourcemap ?? BUILD_DEFAULTS.sourcemap,
    assetsDir,
    // File-name patterns default off `assetsDir`; explicit values win.
    entryFileNames: raw.build?.entryFileNames ?? `${assetsDir}/[name]-[hash].js`,
    chunkFileNames: raw.build?.chunkFileNames ?? `${assetsDir}/[name]-[hash].js`,
    assetFileNames:
      raw.build?.assetFileNames ?? `${assetsDir}/[name]-[hash][extname]`,
  };

  const preview: ResolvedPreviewConfig = {
    port: raw.preview?.port ?? PREVIEW_DEFAULTS.port,
    host: raw.preview?.host ?? PREVIEW_DEFAULTS.host,
    open: raw.preview?.open ?? PREVIEW_DEFAULTS.open,
  };

  const alias: AliasEntry[] = Object.entries(raw.resolve?.alias ?? {})
    .map(([find, replacement]) => ({
      find,
      replacement: resolveFrom(root, replacement),
    }))
    // Longest find first, so `@foo` wins over `@`.
    .sort((a, b) => b.find.length - a.find.length);
  const resolve: ResolvedResolveConfig = {
    alias,
    extensions: RESOLVE_EXTENSIONS,
  };

  return { raw, paths, base, dev, build, preview, resolve, configFile };
}

/** Ensures the base path starts and ends with `/` (leaving absolute URLs intact). */
function normalizeBase(base: string): string {
  let value = base.trim() || "/";
  if (!/^https?:\/\//.test(value) && !value.startsWith("/")) {
    value = `/${value}`;
  }
  if (!value.endsWith("/")) value = `${value}/`;
  return value;
}
