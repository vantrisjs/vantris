import { readFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import type { Context } from "../types/context.js";
import type { HtmlEntry } from "../types/html.js";
import { HTML_ENTRY_FILENAME } from "../shared/constants.js";
import { BuildError, HtmlEntryError } from "../shared/errors.js";
import { isFile } from "../utils/fs.js";
import { buildDefine } from "../env/index.js";
import { bundle, bundleLibrary, entryFileName } from "./bundle.js";
import {
  collectAssetRefs,
  injectStylesheets,
  resolveHtmlEntries,
  resolveSourceRef,
  renderProductionHtml,
  type HtmlReplacement,
} from "./html.js";
import { copyPublicDir, emitHashedAsset } from "./assets.js";
import { emitStyle, isStyle, loadPostcss, processStyle } from "./css.js";
import { prepareOutDir, writeHtml } from "./output.js";

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
  // Library mode is a separate, HTML-free pipeline.
  if (ctx.config.build.lib) return runLibraryBuild(ctx);

  const { paths, build } = ctx.config;
  const log = ctx.logger;
  const started = Date.now();
  const rel = (p: string) => relative(paths.root, p) || ".";

  log.debug("building for production…");

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

  // Empty (when configured) and prepare the output directory — safely guarded.
  log.debug(build.emptyOutDir ? `cleaning ${rel(paths.outDir)}${sep}` : "keeping outDir");
  await prepareOutDir(
    { outDir: paths.outDir, root: paths.root, rootDir: paths.rootDir, publicDir: paths.publicDir },
    build.emptyOutDir,
  );

  const inputs = Object.fromEntries(
    htmlEntries.map((e) => [e.name, e.entryFile]),
  );
  const postcss = await loadPostcss(paths.root);
  log.debug(
    `bundling ${htmlEntries.length} entr${htmlEntries.length === 1 ? "y" : "ies"} with Rolldown…`,
  );
  const { output, cssByEntry } = await bundle({
    entries: inputs,
    config: ctx.config,
    resolver: ctx.resolver,
    define: buildDefine(ctx.env, ctx.mode, ctx.config.base, ctx.config.define),
    postcss,
  });
  log.debug(
    `bundled ${output.length} file(s)` +
      (build.minify ? " (minified)" : "") +
      (build.sourcemap ? " + sourcemaps" : ""),
  );

  // Copy public assets first, then write the generated HTML last so it always
  // wins over a `public/index.html` (which would otherwise shadow the entry).
  if (await copyPublicDir(paths.publicDir, paths.outDir)) {
    log.debug(`copied ${rel(paths.publicDir)}${sep} → ${rel(paths.outDir)}${sep}`);
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
    sourcemap: build.sourcemap,
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
      const { css, map } = await processStyle(file, styleOptions);
      const name = basename(file).replace(/\.(scss|sass|less|styl|stylus)$/i, ".css");
      fileName = await emitStyle(styleOptions, name, css, map);
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

  if (stylesheets.length > 0) log.debug(`css: ${stylesheets.length} stylesheet(s)`);
  if (assetCount > 0) log.debug(`html assets: ${assetCount} rewritten from rootDir`);

  const durationMs = Date.now() - started;
  const fileCount = output.length + 1 + stylesheets.length + assetCount;
  log.debug(`build complete in ${durationMs}ms — ${fileCount} files in ${rel(paths.outDir)}${sep}`);

  return { outDir: paths.outDir, entries, durationMs, fileCount };
}

/**
 * Produces a library build: a single entry bundled into every requested format
 * (`esm`/`cjs`/`iife`) in one pass. There is no HTML pipeline — the output is a
 * set of distribution files in `outDir`.
 *
 * @throws {BuildError} when the entry is missing or bundling fails.
 */
async function runLibraryBuild(ctx: Context): Promise<BuildResult> {
  const { paths, build } = ctx.config;
  const lib = build.lib!;
  const log = ctx.logger;
  const started = Date.now();
  const rel = (p: string) => relative(paths.root, p) || ".";

  if (!(await isFile(lib.entry))) {
    throw new BuildError(`Library entry not found: ${lib.entry}`);
  }

  log.debug(build.emptyOutDir ? `cleaning ${rel(paths.outDir)}${sep}` : "keeping outDir");
  await prepareOutDir(
    { outDir: paths.outDir, root: paths.root, rootDir: paths.rootDir, publicDir: paths.publicDir },
    build.emptyOutDir,
  );

  const postcss = await loadPostcss(paths.root);
  log.debug(`bundling library for ${lib.formats.join(", ")}…`);
  const { files } = await bundleLibrary({
    config: ctx.config,
    resolver: ctx.resolver,
    define: buildDefine(ctx.env, ctx.mode, ctx.config.base, ctx.config.define),
    postcss,
  });

  const durationMs = Date.now() - started;
  log.debug(`library build complete in ${durationMs}ms → ${rel(paths.outDir)}${sep}`);

  return {
    outDir: paths.outDir,
    entries: files.map((f) => ({ src: lib.entry, fileName: f.fileName })),
    durationMs,
    fileCount: files.length,
  };
}
