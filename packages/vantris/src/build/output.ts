import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HTML_ENTRY_FILENAME } from "../shared/constants.js";
import { BuildError } from "../shared/errors.js";
import { isWithin } from "../utils/paths.js";

/** Paths needed to safely clean the output directory. */
export interface OutDirGuard {
  outDir: string;
  root: string;
  rootDir: string;
  publicDir: string;
}

/**
 * Guards against an `outDir` that would destroy the project — it must not be
 * the root or a source directory, nor an ancestor of the root. The single
 * place this safety rule lives.
 *
 * @throws {BuildError} when `outDir` overlaps the project root or sources.
 */
export function assertSafeOutDir(guard: OutDirGuard): void {
  const { outDir, root, rootDir, publicDir } = guard;
  const clashes = outDir === root || outDir === rootDir || outDir === publicDir;
  if (clashes || isWithin(outDir, root)) {
    throw new BuildError(
      `Refusing to clean outDir "${outDir}": it overlaps the project root or source directories.`,
    );
  }
}

/**
 * Removes the output directory and recreates it empty.
 *
 * Bundler chunks are written by Rolldown; this guarantees a clean slate so
 * stale files from a previous build never linger.
 */
export async function cleanOutDir(outDir: string): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
}

/**
 * Prepares the output directory for a build. When `empty` is `true` the
 * directory is safely wiped (guarded by {@link assertSafeOutDir}); otherwise it
 * is merely ensured to exist, so prior output is left in place.
 */
export async function prepareOutDir(
  guard: OutDirGuard,
  empty: boolean,
): Promise<void> {
  if (empty) {
    assertSafeOutDir(guard);
    await cleanOutDir(guard.outDir);
  } else {
    await mkdir(guard.outDir, { recursive: true });
  }
}

/**
 * Writes the production `index.html` into the output directory.
 *
 * @returns The absolute path of the written file.
 */
export async function writeHtml(outDir: string, html: string): Promise<string> {
  const file = join(outDir, HTML_ENTRY_FILENAME);
  await writeFile(file, html, "utf8");
  return file;
}
