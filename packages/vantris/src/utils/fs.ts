import { mkdir, readFile, stat } from "node:fs/promises";

/** Returns `true` if `path` exists and is a regular file. */
export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Returns `true` if `path` exists and is a directory. */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** Reads a UTF-8 text file. */
export function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/** Creates a directory (and any missing parents) if it does not exist. */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}
