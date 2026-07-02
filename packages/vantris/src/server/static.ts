import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { isFile } from "../utils/fs.js";
import { isWithin } from "../utils/paths.js";
import { cacheKey, type Cache } from "../cache/index.js";
import { contentTypeFor } from "./mime.js";
import { shouldTranspile, transpile } from "./transform.js";
import { inlineAssetImports, rewriteImports, type AliasUrl } from "./rewrite.js";

/** Transpiles a module, returning cached output when the source is unchanged. */
type TranspileFn = (source: string, file: string) => Promise<string>;

/** Extensions tried when a request has no extension (bare module imports). */
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".jsx"];

/** A resolved, ready-to-serve asset. */
export interface LoadedAsset {
  /** Response body — text for transpiled/HTML, bytes for binary assets. */
  body: string | Uint8Array;
  /** Resolved `Content-Type`. */
  contentType: string;
  /** `true` when the asset is an HTML document. */
  isHtml: boolean;
}

export interface StaticLoaderOptions {
  /** Project root — base for resolving root-relative request paths. */
  root: string;
  /**
   * Source directory. Only files **inside** this directory are reachable via
   * root-relative paths (e.g. `/src/main.ts`). This is what keeps
   * `node_modules`, `package.json`, lockfiles, and config files unreachable.
   */
  rootDir: string;
  /** Public directory whose contents are served at `/` (Vite-style). */
  publicDir: string;
  /** `import.meta.env` replacements applied during transpilation. */
  define?: Record<string, string>;
  /** Alias → dev-URL rewrites applied to transpiled module imports. */
  aliases?: readonly AliasUrl[];
  /** Dev base path prepended to generated asset URLs. @default "/" */
  base?: string;
  /** Optional persistent cache for transpiled modules. */
  cache?: Cache;
  /** Directory of pre-bundled dependencies to serve. */
  depsDir?: string;
  /** Serve prefix for pre-bundled deps (e.g. `/@deps/`). */
  depsPrefix?: string;
  /** Bare specifier → served URL, from pre-bundling. */
  bareImports?: ReadonlyMap<string, string>;
}

/**
 * Creates a per-request asset loader for the dev server.
 *
 * The serveable surface is an **allowlist** — only the source tree (`rootDir`)
 * and the public directory are exposed; nothing else under the project root is
 * reachable. Files are read fresh on every call so edits show up on reload, and
 * TypeScript/JSX is transpiled on the fly.
 *
 * @returns A function resolving a pathname to a {@link LoadedAsset}, or `null`
 *          when nothing matches (or the path is outside the allowlist).
 */
export function createStaticLoader(options: StaticLoaderOptions) {
  const root = resolve(options.root);
  const rootDir = resolve(options.rootDir);
  const publicDir = resolve(options.publicDir);
  const aliases = options.aliases ?? [];
  const base = options.base ?? "/";
  const bareImports = options.bareImports;
  const depsPrefix = options.depsPrefix?.replace(/^\/+/, ""); // e.g. "@deps/"
  const transpiler = makeTranspiler(options.define, options.cache);

  return async function loadAsset(
    pathname: string,
  ): Promise<LoadedAsset | null> {
    const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
    if (!relative) return null;

    // 0. Pre-bundled dependency (already valid ESM — served verbatim).
    if (options.depsDir && depsPrefix && relative.startsWith(depsPrefix)) {
      const depFile = resolve(options.depsDir, relative.slice(depsPrefix.length));
      if (isWithin(options.depsDir, depFile) && (await isFile(depFile))) {
        return { body: await readFile(depFile), contentType: contentTypeFor(depFile), isHtml: false };
      }
      return null;
    }

    // 1. Source files: resolved against the root but confined to `rootDir`,
    //    so only the source subtree (e.g. `/src/*`) is ever served.
    const source = await resolveConfined(root, rootDir, relative);
    if (source) return readAsset(source, root, transpiler, aliases, base, bareImports);

    // 2. Public assets: served at `/` (e.g. `/favicon.svg`).
    const asset = await resolveConfined(publicDir, publicDir, relative);
    if (asset) return readAsset(asset, root, transpiler, aliases, base, bareImports);

    return null;
  };
}

/**
 * Builds a memoised, optionally-persistent transpiler. Output is keyed by the
 * source content (plus defines and extension), so it is **content-addressed**:
 * a hit is always valid, and an edit naturally produces a new key. An in-memory
 * map avoids re-reading the disk cache within a session.
 */
function makeTranspiler(
  define: Record<string, string> | undefined,
  cache?: Cache,
): TranspileFn {
  const memo = new Map<string, string>();
  const defineKey = define ? JSON.stringify(define) : "";

  return async (source, file) => {
    const key = cacheKey(source, defineKey, extname(file).toLowerCase());
    const hit = memo.get(key);
    if (hit !== undefined) return hit;

    const stored = cache
      ? (await cache.read(`transform/${key}.js`))?.toString("utf8")
      : undefined;
    if (stored !== undefined) {
      memo.set(key, stored);
      return stored;
    }

    const output = await transpile(source, file, define);
    memo.set(key, output);
    if (cache) await cache.write(`transform/${key}.js`, output);
    return output;
  };
}

/**
 * Resolves `relative` against `base`, trying extension candidates, and returns
 * the file only if it lands inside `confine` (the allowlist boundary). This
 * single check rejects both path traversal (`..`) and anything outside the
 * permitted directories.
 */
async function resolveConfined(
  base: string,
  confine: string,
  relative: string,
): Promise<string | null> {
  const target = resolve(join(base, relative));
  if (!isWithin(confine, target)) return null;

  if (await isFile(target)) return target;

  if (!extname(target)) {
    for (const ext of RESOLVE_EXTENSIONS) {
      const candidate = `${target}${ext}`;
      if (await isFile(candidate)) return candidate;
    }
  }
  return null;
}

/** Reads a file, transpiling it when needed, and resolves its content type. */
async function readAsset(
  file: string,
  root: string,
  transpileModule: TranspileFn,
  aliases: readonly AliasUrl[],
  base: string,
  bareImports: ReadonlyMap<string, string> | undefined,
): Promise<LoadedAsset> {
  const ext = extname(file).toLowerCase();
  const isHtml = ext === ".html";

  if (shouldTranspile(file)) {
    const source = await readFile(file, "utf8");
    const transpiled = await transpileModule(source, file);
    // Aliases + bare deps first, then inline asset imports to their dev URL —
    // so `import logo from "./logo.svg"` behaves exactly as in the build.
    const body = inlineAssetImports(
      rewriteImports(transpiled, aliases, bareImports),
      file,
      root,
      base,
    );
    return {
      body,
      contentType: contentTypeFor(file, true),
      isHtml: false,
    };
  }

  if (isHtml) {
    return {
      body: await readFile(file, "utf8"),
      contentType: contentTypeFor(file),
      isHtml: true,
    };
  }

  return {
    body: await readFile(file),
    contentType: contentTypeFor(file),
    isHtml: false,
  };
}
