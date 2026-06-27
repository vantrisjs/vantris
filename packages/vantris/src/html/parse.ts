import type { HtmlEntry } from "../types/html.js";

/**
 * Parses raw HTML into an {@link HtmlEntry}.
 *
 * v0.1.0 keeps this intentionally minimal: it only wraps the file path and
 * contents. The function exists as the single, isolated home for HTML
 * analysis so later versions can grow it (extracting `<script type="module">`
 * entries, asset references, injection points for HMR) without scattering
 * parsing logic across the codebase.
 */
export function parseHtml(file: string, html: string): HtmlEntry {
  return { file, html };
}
