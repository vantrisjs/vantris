/**
 * The HTML entry point of a project, as discovered and parsed by the
 * `html` subsystem. Parsing is deliberately minimal in v0.1.0 — only what is
 * needed to locate the entry — but the shape anticipates richer analysis
 * (script tags, module graph roots, asset references) in later versions.
 */
export interface HtmlEntry {
  /** Absolute path to the `index.html` file. */
  file: string;
  /** Raw HTML contents. */
  html: string;
}
