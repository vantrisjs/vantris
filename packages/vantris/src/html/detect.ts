import type { HtmlEntry } from "../types/html.js";
import { HTML_ENTRY_FILENAME } from "../shared/constants.js";
import { isFile, readTextFile } from "../utils/fs.js";
import { resolveFrom } from "../utils/paths.js";
import { parseHtml } from "./parse.js";

/**
 * Locates the project's `index.html` entry at `root`.
 *
 * @returns The parsed {@link HtmlEntry}, or `null` if no entry exists.
 */
export async function detectHtmlEntry(root: string): Promise<HtmlEntry | null> {
  const file = resolveFrom(root, HTML_ENTRY_FILENAME);
  if (!(await isFile(file))) return null;

  const html = await readTextFile(file);
  return parseHtml(file, html);
}
