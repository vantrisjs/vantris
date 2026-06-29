import { readFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import type { Context } from "../types/context.js";
import type { HtmlEntry } from "../types/html.js";
import { HTML_ENTRY_FILENAME } from "../shared/constants.js";
import { BuildError, HtmlEntryError } from "../shared/errors.js";
import { isFile } from "../utils/fs.js";
import { isWithin } from "../utils/paths.js";
import { envDefine } from "../env/index.js";
import { bundle, entryFileName } from "./bundle.js";
import {
  collectAssetRefs,
  injectStylesheets,
  resolveHtmlEntries,
  resolveSourceRef,
  renderProductionHtml,
  type HtmlReplacement,
} from "./html.js";
import { copyPublicDir, emitHashedAsset } from "./assets.js";
import { isStyle, loadPostcss, processStyle } from "./css.js";
import { cleanOutDir, writeHtml } from "./output.js";

/** Options handed to the build pipeline. */
export interface BuildOptions {
  ctx: Context;
  /** The detected HTML entry; required for a build. */
  entry: HtmlEntry | null;
}

/** Summary of a completed build. */
export interface BuildResult {
  /** Absolute output directory. */
  outDir: string;
  /** Entry points: original HTML `src` → emitted file name. */
  entries: ReadonlyArray<{ src: string; fileName: string }>;
  /** Total build duration in milliseconds. */
  durationMs: number;
  /** Number of files emitted by the bundler (chunks + assets), plus HTML. */
  fileCount: number;
}

/**
 * Produces an optimised production build into `outDir`.
 *
 * The pipeline is split across the `build` module by responsibility — entry
 * resolution + HTML ({@link resolveHtmlEntry}/{@link renderProductionHtml}),
 * bundling ({@link bundle}), assets ({@link copyPublicDir}), and filesystem
 * output ({@link cleanOutDir}/{@link writeHtml}). This file only orchestrates
 * and logs, which keeps each stage independently testable and leaves room for
 * future build hooks/plugins to slot between stages.
 *
 * @throws {HtmlEntryError | BuildError} with an explicit message on failure.
 */
export async function runBuild(options: BuildOptions): Promise<BuildResult> {
  const { ctx, entry } = options;
  const { paths, build } = ctx.config;
  const log = ctx.logger;
  const started = Date.now();
  const rel = (p: string) => relative(paths.root, p) || ".";

  log.info("building for production…");

  if (!entry) {
    throw new HtmlEntryError(
      `No index.html found at ${paths.root}; nothing to build.`,
    );
  }

  // Resolve every module entry from the HTML before touching the filesystem.
  const htmlEntries = resolveHtmlEntries(entry, paths);
  for (const { entryFile, entrySrc } of htmlEntries) {
    if (!(await isFile(entryFile))) {
      throw new BuildError(
        `Entry module "${entrySrc}" resolves to a missing file: ${entryFile}`,
      );
    }
  }

  // Refuse to wipe anything that would destroy the project.
  assertSafeOutDir(paths.outDir, paths.root, paths.rootDir, paths.publicDir);

  log.info(`cleaning ${rel(paths.outDir)}${sep}`);
  await cleanOutDir(paths.outDir);

  const inputs = Object.fromEntries(
    htmlEntries.map((e) => [e.name, e.entryFile]),
  );
  const postcss = await loadPostcss(paths.root);
  log.info(
    `bundling ${htmlEntries.length} entr${htmlEntries.length === 1 ? "y" : "ies"} with Rolldown…`,
  );
  const { output, cssByEntry } = await bundle({
    entries: inputs,
    config: ctx.config,
    resolver: ctx.resolver,
    define: envDefine(ctx.env, ctx.mode, ctx.config.base),
    postcss,
  });
  log.info(
    `bundled ${output.length} file(s)` +
      (build.minify ? " (minified)" : "") +
      (build.sourcemap ? " + sourcemaps" : ""),
  );

  // Copy public assets first, then write the generated HTML last so it always
  // wins over a `public/index.html` (which would otherwise shadow the entry).
  if (await copyPublicDir(paths.publicDir, paths.outDir)) {
    log.info(`copied ${rel(paths.publicDir)}${sep} → ${rel(paths.outDir)}${sep}`);
    if (await isFile(join(paths.publicDir, HTML_ENTRY_FILENAME))) {
      log.warn(
        `public/${HTML_ENTRY_FILENAME} is ignored — the generated entry HTML takes precedence.`,
      );
    }
  }

  const base = ctx.config.base;
  const url = (fileName: string) => `${base}${fileName}`;
  const replacements: HtmlReplacement[] = [];
  const entrySrcs = new Set(htmlEntries.map((e) => e.entrySrc));

  // 1. Entry scripts → hashed JS.
  const entries = htmlEntries.map((e) => {
    const fileName = entryFileName(output, e.name);
    replacements.push({ from: e.entrySrc, to: url(fileName) });
    return { src: e.entrySrc, fileName };
  });

  // 2. CSS imported from JS → already emitted per entry by the bundler.
  const stylesheets: string[] = [];
  for (const e of htmlEntries) {
    const cssFile = cssByEntry.get(e.name);
    if (cssFile) stylesheets.push(url(cssFile));
  }

  // 3. HTML `src`/`href` that point into `rootDir` → hashed + rewritten.
  //    Stylesheets go through the full CSS pipeline; public and external
  //    references are left untouched.
  const styleOptions = {
    paths,
    outDir: paths.outDir,
    assetsDir: build.assetsDir,
    base,
    minify: build.minify,
    postcss,
    resolver: ctx.resolver,
  };
  let assetCount = 0;
  for (const ref of collectAssetRefs(entry.html)) {
    if (entrySrcs.has(ref)) continue;
    const file = resolveSourceRef(ref, paths, ctx.resolver);
    if (!file || !(await isFile(file))) continue;

    let fileName: string;
    if (isStyle(file)) {
      const { css } = await processStyle(file, styleOptions);
      const name = basename(file).replace(/\.(scss|sass|less|styl|stylus)$/i, ".css");
      fileName = await emitHashedAsset(paths.outDir, build.assetsDir, name, css);
    } else {
      fileName = await emitHashedAsset(
        paths.outDir,
        build.assetsDir,
        basename(file),
        await readFile(file),
      );
    }
    replacements.push({ from: ref, to: url(fileName) });
    assetCount += 1;
  }

  let html = renderProductionHtml(entry.html, replacements);
  html = injectStylesheets(html, stylesheets);
  await writeHtml(paths.outDir, html);

  if (stylesheets.length > 0) log.info(`css: ${stylesheets.length} stylesheet(s)`);
  if (assetCount > 0) log.info(`html assets: ${assetCount} rewritten from rootDir`);

  const durationMs = Date.now() - started;
  const fileCount = output.length + 1 + stylesheets.length + assetCount;
  log.info(`build complete in ${durationMs}ms — ${fileCount} files in ${rel(paths.outDir)}${sep}`);

  return { outDir: paths.outDir, entries, durationMs, fileCount };
}

/** Guards against an `outDir` that overlaps the project's source/root. */
function assertSafeOutDir(
  outDir: string,
  root: string,
  rootDir: string,
  publicDir: string,
): void {
  const clashes = outDir === root || outDir === rootDir || outDir === publicDir;
  if (clashes || isWithin(outDir, root)) {
    throw new BuildError(
      `Refusing to clean outDir "${outDir}": it overlaps the project root or source directories.`,
    );
  }
}
