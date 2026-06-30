import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Context } from "../types/context.js";
import { VERSION } from "../shared/constants.js";

/**
 * Vantris's internal, persistent cache — rooted at `node_modules/.vantris`.
 *
 * It is **transparent** (callers treat misses and hits identically) and
 * **self-invalidating**: a manifest records the Vantris version and a config
 * fingerprint, and the whole cache is wiped the moment either changes, so stale
 * entries can never be served. Living under `node_modules` keeps it out of the
 * project root and git by convention.
 */
export interface Cache {
  /** Absolute cache directory. */
  readonly dir: string;
  /** Reads a cached blob by key, or `null` on a miss. */
  read(key: string): Promise<Buffer | null>;
  /** Writes a cached blob by key (parent directories are created). */
  write(key: string, data: string | Uint8Array): Promise<void>;
  /** Reads and parses a cached JSON value, or `null` on a miss/parse error. */
  readJSON<T>(key: string): Promise<T | null>;
  /** Writes a JSON value. */
  writeJSON(key: string, value: unknown): Promise<void>;
  /** Removes the entire cache directory. */
  clear(): Promise<void>;
}

export interface CacheOptions {
  /** Absolute cache directory (e.g. `node_modules/.vantris`). */
  dir: string;
  /** Vantris version — a change invalidates every entry. */
  version: string;
  /** Config fingerprint — a change invalidates every entry. */
  fingerprint: string;
}

const MANIFEST = "manifest.json";

/** Creates a {@link Cache}. The directory is initialised lazily on first use. */
export function createCache(options: CacheOptions): Cache {
  const { dir } = options;
  let ready: Promise<void> | null = null;
  const ensure = (): Promise<void> => (ready ??= init(options));

  // Confines a key to the cache directory: drops leading slashes and any
  // `.`/`..` segments so a key can never escape `dir`.
  const pathFor = (key: string): string => {
    const safe = key
      .split(/[/\\]+/)
      .filter((segment) => segment && segment !== "." && segment !== "..")
      .join("/");
    return join(dir, safe || "entry");
  };

  const cache: Cache = {
    dir,
    async read(key) {
      await ensure();
      try {
        return await readFile(pathFor(key));
      } catch {
        return null;
      }
    },
    async write(key, data) {
      await ensure();
      const file = pathFor(key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async readJSON(key) {
      const buffer = await cache.read(key);
      if (!buffer) return null;
      try {
        return JSON.parse(buffer.toString("utf8"));
      } catch {
        return null;
      }
    },
    async writeJSON(key, value) {
      await cache.write(key, JSON.stringify(value));
    },
    async clear() {
      await rm(dir, { recursive: true, force: true });
      ready = null;
    },
  };
  return cache;
}

/** Initialises the cache directory, wiping it when the manifest is stale. */
async function init(options: CacheOptions): Promise<void> {
  const { dir, version, fingerprint } = options;
  const manifestFile = join(dir, MANIFEST);
  await mkdir(dir, { recursive: true });

  let current: { version?: string; fingerprint?: string } = {};
  try {
    current = JSON.parse(await readFile(manifestFile, "utf8"));
  } catch {
    // No (or corrupt) manifest — treated as stale below.
  }

  if (current.version !== version || current.fingerprint !== fingerprint) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await writeFile(manifestFile, JSON.stringify({ version, fingerprint }));
  }
}

/** A short, stable hash of its parts — used to build cache keys. */
export function cacheKey(...parts: Array<string | undefined>): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part ?? "", "utf8");
  return hash.digest("hex").slice(0, 16);
}

/**
 * Builds the cache for a {@link Context}. The fingerprint folds in every
 * setting that affects cached output, so changing the mode, base, defines, or
 * build flags transparently invalidates everything.
 */
export function cacheForContext(ctx: Context): Cache {
  const { config, mode } = ctx;
  return createCache({
    dir: config.cacheDir,
    version: VERSION,
    fingerprint: cacheKey(
      mode,
      config.base,
      JSON.stringify(config.define),
      String(config.build.minify),
      String(config.build.sourcemap),
    ),
  });
}
