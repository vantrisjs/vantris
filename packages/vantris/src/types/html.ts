/**
 * A `<script type="module">` reference discovered in the HTML entry.
 *
 * Only the `src` is captured in v0.2.0. The shape is deliberately an object
 * (rather than a bare string) so later versions can attach resolved paths,
 * inline contents, or transform metadata without breaking consumers.
 */
export interface HtmlModuleScript {
  /** The `src` attribute value, exactly as authored (e.g. `/src/main.ts`). */
  src: string;
}

/**
 * The HTML entry point of a project, as discovered and parsed by the
 * `html` subsystem. Parsing stays intentionally lightweight — just enough to
 * locate the entry and its module scripts — but the shape anticipates richer
 * analysis (asset references, injection points, module graph roots) in later
 * versions on the road to HMR and plugin transforms.
 */
export interface HtmlEntry {
  /** Absolute path to the `index.html` file. */
  file: string;
  /** Raw HTML contents. */
  html: string;
  /** Module scripts (`<script type="module" src=...>`) found in the entry. */
  scripts: HtmlModuleScript[];
}
