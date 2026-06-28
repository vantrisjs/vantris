import { resolve, sep } from "node:path";
import { basename } from "node:path";
import type { HtmlEntry } from "../types/html.js";
import type { ResolvedPaths } from "../types/paths.js";
import type { Resolver } from "../resolver/index.js";
import { BuildError } from "../shared/errors.js";

/** A bundler entry derived from the HTML, plus how to rewrite the HTML. */
export interface HtmlBuildEntry {
  /** Unique bundler input name (drives the `[name]` in output file names). */
  name: string;
  /** Absolute path of the entry module fed to the bundler. */
  entryFile: string;
  /** The original `src` value to replace in the output HTML. */
  entrySrc: string;
}

/** A single output-HTML substitution. */
export interface HtmlReplacement {
  from: string;
  to: string;
}

/**
 * Resolves every `<script type="module" src="...">` in the HTML into a bundler
 * entry. Each `src` (e.g. `/src/main.ts`) is resolved against the project root,
 * and given a unique, stable name derived from its file name.
 *
 * @throws {BuildError} when the HTML has no module script.
 */
export function resolveHtmlEntries(
  entry: HtmlEntry,
  paths: ResolvedPaths,
): HtmlBuildEntry[] {
  if (entry.scripts.length === 0) {
    throw new BuildError(
      `No <script type="module" src="..."> found in ${entry.file}.`,
    );
  }

  const used = new Set<string>();
  return entry.scripts.map((script) => {
    const entryFile = resolve(paths.root, script.src.replace(/^\/+/, ""));
    const base = basename(script.src).replace(/\.[^.]+$/, "") || "entry";

    let name = base;
    for (let i = 1; used.has(name); i++) name = `${base}${i}`;
    used.add(name);

    return { name, entryFile, entrySrc: script.src };
  });
}

/**
 * Produces the production HTML by applying every `src`/`href` substitution.
 *
 * This is the single place where output HTML is shaped, ready to grow toward
 * preload hints and plugin-emitted tags.
 */
export function renderProductionHtml(
  html: string,
  replacements: readonly HtmlReplacement[],
): string {
  let out = html;
  for (const { from, to } of replacements) out = out.replaceAll(from, to);
  return out;
}

/** A URL referenced by `src`/`href` in the HTML. */
const HTML_URL_REF =
  /<(?:link|img|script|source|use)\b[^>]*?\b(?:href|src|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/** Collects the distinct `src`/`href` URLs referenced in the HTML. */
export function collectAssetRefs(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(HTML_URL_REF)) {
    const url = match[1] ?? match[2];
    if (url) urls.add(url);
  }
  return [...urls];
}

/**
 * Resolves an HTML URL to a source file **only** when it lives under `rootDir`.
 *
 * External (`http:`, `//`, `data:`), in-page (`#…`), and public/other URLs
 * return `null` and are left untouched — exactly the requested behaviour:
 * rewrite only what comes from the source tree.
 */
export function resolveSourceRef(
  url: string,
  paths: ResolvedPaths,
  resolver?: Resolver,
): string | null {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || /^(?:data:|#|mailto:)/i.test(url)) {
    return null;
  }
  // An alias (e.g. `@/logo.png`) resolves directly to a source file.
  const aliased = resolver?.alias(url);
  const file = aliased ?? resolve(paths.root, url.replace(/^\/+/, ""));
  const withinRoot =
    file === paths.rootDir || file.startsWith(paths.rootDir + sep);
  return withinRoot ? file : null;
}

/** Injects `<link rel="stylesheet">` tags into the document head. */
export function injectStylesheets(html: string, hrefs: readonly string[]): string {
  if (hrefs.length === 0) return html;
  const links = hrefs
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("\n");
  if (html.includes("</head>")) {
    return html.replace("</head>", `${links}\n</head>`);
  }
  const bodyOpen = /<body[^>]*>/.exec(html);
  if (bodyOpen) {
    return html.replace(bodyOpen[0], `${bodyOpen[0]}\n${links}`);
  }
  return `${links}\n${html}`;
}
