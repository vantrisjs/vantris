import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { HTML_ENTRY_FILENAME } from "../shared/constants.js";
import { contentTypeFor } from "../server/mime.js";
import { isFile } from "../utils/fs.js";
import { isWithin } from "../utils/paths.js";

/** A file read from the build output, ready to serve. */
export interface OutputFile {
  body: Uint8Array;
  contentType: string;
}

/**
 * Creates a loader that serves files from the build output directory **as-is**
 * (no compilation). The request path maps directly to a file under `outDir`;
 * a request for `/` serves `index.html`. Path traversal outside `outDir` is
 * rejected.
 *
 * @returns A function resolving a pathname to an {@link OutputFile}, or `null`.
 */
export function createOutputLoader(outDir: string) {
  const root = resolve(outDir);

  return async function loadFile(pathname: string): Promise<OutputFile | null> {
    const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
    const target = resolve(join(root, relative || HTML_ENTRY_FILENAME));
    if (!isWithin(root, target)) return null;
    if (!(await isFile(target))) return null;

    return { body: await readFile(target), contentType: contentTypeFor(target) };
  };
}
