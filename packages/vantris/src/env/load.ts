import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "./parse.js";

/**
 * The `.env` files loaded for a `mode`, in **ascending** priority — later files
 * override earlier ones, so `.env.[mode].local` wins.
 */
export function envFilesFor(mode: string): string[] {
  return [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
}

/**
 * Loads and merges the `.env` files for `mode` from `root`.
 *
 * This is the internal env API — a future plugin system can call it to read
 * the resolved environment for a given mode.
 *
 * @returns The merged variables (missing files are skipped).
 */
export async function loadEnv(
  mode: string,
  root: string,
): Promise<Record<string, string>> {
  const env: Record<string, string> = {};

  for (const file of envFilesFor(mode)) {
    const contents = await readFile(join(root, file), "utf8").catch(() => null);
    if (contents !== null) Object.assign(env, parseEnv(contents));
  }

  return env;
}
