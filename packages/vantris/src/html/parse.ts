import type { HtmlEntry, HtmlModuleScript } from "../types/html.js";

/** Matches `<script ... type="module" ... src="...">` tags (any attr order). */
const SCRIPT_TAG = /<script\b[^>]*>/gi;
const TYPE_MODULE = /\btype\s*=\s*["']module["']/i;
const SRC_ATTR = /\bsrc\s*=\s*["']([^"']+)["']/i;

/**
 * Parses raw HTML into an {@link HtmlEntry}, extracting `<script type="module">`
 * `src` references.
 *
 * The analysis is intentionally regex-light rather than a full DOM parse: in
 * dev we only need to know the module entry points. This module is the single,
 * isolated home for HTML analysis, so it can grow toward a real parser (for
 * HMR boundaries, plugin transforms, virtual modules) without touching callers.
 */
export function parseHtml(file: string, html: string): HtmlEntry {
  const scripts: HtmlModuleScript[] = [];

  for (const [tag] of html.matchAll(SCRIPT_TAG)) {
    if (!TYPE_MODULE.test(tag)) continue;
    const src = SRC_ATTR.exec(tag)?.[1];
    if (src) scripts.push({ src });
  }

  return { file, html, scripts };
}
