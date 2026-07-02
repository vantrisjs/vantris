import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";
import type { Context } from "../types/context.js";
import { isFile } from "../utils/fs.js";

/**
 * The result of pre-bundling: where the optimised dependencies live and how
 * bare imports map to their served URL.
 */
export interface Prebundle {
  /** Absolute directory holding the bundled dependencies. */
  dir: string;
  /** Path prefix (base-stripped) the deps are served under. */
  servePrefix: string;
  /** Bare specifier → served URL (base-aware, for the browser). */
  imports: Map<string, string>;
}

/** Sanitises a package name into a flat file name. */
const flatName = (name: string): string => name.replace(/[/@]/g, "_");

const SERVE_PREFIX = "@deps/";

/**
 * Pre-optimises the project's `dependencies` with esbuild into
 * `node_modules/.vantris/deps/`, so the dev server can serve real ESM even for
 * CommonJS packages and cold starts stay fast. The work is cached: unchanged
 * dependencies are reused across restarts.
 *
 * Packages that fail to bundle are skipped (their imports are left untouched)
 * rather than failing the whole server — pre-bundling is an optimisation, never
 * a hard requirement.
 */
export async function prebundleDeps(ctx: Context): Promise<Prebundle> {
  const dir = join(ctx.config.cacheDir, "deps");
  const base = ctx.config.server.base;
  const imports = new Map<string, string>();
  const empty: Prebundle = { dir, servePrefix: `/${SERVE_PREFIX}`, imports };

  const pkg = await readJson<{ dependencies?: Record<string, string> }>(
    join(ctx.config.paths.root, "package.json"),
  );
  const deps = pkg?.dependencies ?? {};
  const names = Object.keys(deps);
  if (names.length === 0) return empty;

  await mkdir(dir, { recursive: true });
  const key = createHash("sha256").update(JSON.stringify(deps)).digest("hex").slice(0, 16);
  const metaFile = join(dir, "_meta.json");
  const fresh = (await readJson<{ key?: string }>(metaFile))?.key === key;

  const nodeEnv = ctx.mode === "production" ? "production" : "development";
  let built = 0;

  for (const name of names) {
    const file = `${flatName(name)}.mjs`;
    const outfile = join(dir, file);
    imports.set(name, `${base}${SERVE_PREFIX}${file}`);

    if (fresh && (await isFile(outfile))) continue;

    try {
      await build({
        entryPoints: [name],
        bundle: true,
        format: "esm",
        platform: "browser",
        outfile,
        absWorkingDir: ctx.config.paths.root,
        logLevel: "silent",
        define: { "process.env.NODE_ENV": JSON.stringify(nodeEnv) },
      });
      built++;
    } catch (error) {
      // Not bundleable (e.g. no browser entry) — leave the import as authored.
      imports.delete(name);
      ctx.logger.debug(`prebundle: skipped ${name} (${(error as Error).message})`);
    }
  }

  if (built > 0) {
    await writeFile(metaFile, JSON.stringify({ key }));
  }
  if (imports.size > 0) {
    ctx.logger.debug(`prebundled ${imports.size} dependenc${imports.size === 1 ? "y" : "ies"}`);
  }
  return { dir, servePrefix: `/${SERVE_PREFIX}`, imports };
}

/** Reads and parses a JSON file, or `null` on any failure. */
async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}
