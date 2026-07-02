import { basename } from "node:path";
import type {
  Config,
  DefineValue,
  LibConfig,
  ServerConfig,
} from "../types/config.js";
import type {
  AliasEntry,
  ResolvedBuildConfig,
  ResolvedConfig,
  ResolvedCors,
  ResolvedDevConfig,
  ResolvedLibConfig,
  ResolvedPreviewConfig,
  ResolvedProxyRule,
  ResolvedResolveConfig,
  ResolvedServerConfig,
} from "../types/config-resolved.js";
import type { ResolvedPaths } from "../types/paths.js";
import {
  BUILD_DEFAULTS,
  CACHE_DIRNAME,
  DEFAULTS,
  DEV_DEFAULTS,
  LIB_DEFAULT_FORMATS,
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

  const server = resolveServer(raw.server, base);

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
    emptyOutDir: raw.build?.emptyOutDir ?? BUILD_DEFAULTS.emptyOutDir,
    lib: resolveLib(raw.build?.lib, root),
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

  const define = resolveDefine(raw.define);
  const cacheDir = resolveFrom(root, CACHE_DIRNAME);

  return {
    raw,
    paths,
    base,
    dev,
    server,
    build,
    preview,
    resolve,
    define,
    cacheDir,
    configFile,
  };
}

const DEFAULT_CORS_METHODS = ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"];

/** Normalises dev-server network options; `base` falls back to the global base. */
function resolveServer(
  server: ServerConfig | undefined,
  globalBase: string,
): ResolvedServerConfig {
  const proxy: ResolvedProxyRule[] = Object.entries(server?.proxy ?? {})
    .map(([context, value]) => {
      const options = typeof value === "string" ? { target: value } : value;
      return {
        context,
        target: options.target,
        changeOrigin: options.changeOrigin ?? true,
        secure: options.secure ?? true,
        rewrite: options.rewrite ?? null,
      };
    })
    // Longest prefix first, so `/api/v2` wins over `/api`.
    .sort((a, b) => b.context.length - a.context.length);

  let cors: ResolvedCors | null = null;
  if (server?.cors) {
    const value = server.cors === true ? {} : server.cors;
    cors = {
      origin: value.origin ?? true,
      methods: value.methods ?? DEFAULT_CORS_METHODS,
      headers: value.headers ?? [],
      credentials: value.credentials ?? false,
    };
  }

  return {
    https: server?.https ?? false,
    proxy,
    cors,
    base: server?.base ? normalizeBase(server.base) : globalBase,
    spaFallback: server?.spaFallback ?? true,
  };
}

/** Serialises each {@link DefineValue} to a JSON literal for static replacement. */
function resolveDefine(
  define: Record<string, DefineValue> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(define ?? {})) {
    out[key] = JSON.stringify(value);
  }
  return out;
}

/** Normalises library-mode options, making the entry absolute. */
function resolveLib(
  lib: LibConfig | undefined,
  root: string,
): ResolvedLibConfig | null {
  if (!lib) return null;
  return {
    entry: resolveFrom(root, lib.entry),
    name: lib.name ?? null,
    formats: lib.formats ?? LIB_DEFAULT_FORMATS,
    fileName: lib.fileName ?? basename(lib.entry).replace(/\.[^.]+$/, ""),
  };
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
