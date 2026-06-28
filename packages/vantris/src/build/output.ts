import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HTML_ENTRY_FILENAME } from "../shared/constants.js";

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
 * Writes the production `index.html` into the output directory.
 *
 * @returns The absolute path of the written file.
 */
export async function writeHtml(outDir: string, html: string): Promise<string> {
  const file = join(outDir, HTML_ENTRY_FILENAME);
  await writeFile(file, html, "utf8");
  return file;
}
