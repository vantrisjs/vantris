import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { isFile } from "../utils/fs.js";
import { contentTypeFor } from "./mime.js";
import { shouldTranspile, transpile } from "./transform.js";

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

  return async function loadAsset(
    pathname: string,
  ): Promise<LoadedAsset | null> {
    const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
    if (!relative) return null;

    // 1. Source files: resolved against the root but confined to `rootDir`,
    //    so only the source subtree (e.g. `/src/*`) is ever served.
    const source = await resolveConfined(root, rootDir, relative);
    if (source) return readAsset(source);

    // 2. Public assets: served at `/` (e.g. `/favicon.svg`).
    const asset = await resolveConfined(publicDir, publicDir, relative);
    if (asset) return readAsset(asset);

    return null;
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
  if (target !== confine && !target.startsWith(confine + sep)) {
    return null;
  }

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
async function readAsset(file: string): Promise<LoadedAsset> {
  const ext = extname(file).toLowerCase();
  const isHtml = ext === ".html";

  if (shouldTranspile(file)) {
    const source = await readFile(file, "utf8");
    return {
      body: await transpile(source, file),
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
