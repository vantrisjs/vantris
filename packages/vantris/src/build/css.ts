import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { bundleAsync } from "lightningcss";
import type { Plugin } from "rolldown";
import type { ResolvedPaths } from "../types/paths.js";
import type { Resolver } from "../resolver/index.js";
import { BuildError } from "../shared/errors.js";
import { isWithin } from "../utils/paths.js";
import { contentHash, emitHashedAsset } from "./assets.js";

const STYLE_RE = /\.(css|scss|sass|less)$/i;
const MODULE_RE = /\.module\.[^.]+$/i;

function stripQuery(path: string): string {
  return path.split("?", 1)[0] ?? path;
}

/** Whether a path is a stylesheet (CSS or a supported preprocessor). */
export function isStyle(path: string): boolean {
  return STYLE_RE.test(stripQuery(path));
}

/** Whether a path is a CSS module (`*.module.*`). */
export function isCssModule(path: string): boolean {
  return MODULE_RE.test(stripQuery(path));
}

/** Runs CSS through a project's PostCSS config (e.g. Tailwind, autoprefixer). */
export type PostcssRunner = (css: string, from: string) => Promise<string>;

/** Options shared by every style transform. */
export interface StyleOptions {
  paths: ResolvedPaths;
  outDir: string;
  assetsDir: string;
  base: string;
  minify: boolean;
  /** Source-map strategy (mirrors `build.sourcemap`). @default false */
  sourcemap?: boolean | "inline" | "hidden";
  /** PostCSS runner, when the project has a PostCSS config. */
  postcss?: PostcssRunner | null;
  /** Central resolver, for aliases in `@import` and `url()`. */
  resolver?: Resolver;
}

/**
 * Loads the project's PostCSS config (if any) into a runner.
 *
 * Returns `null` when there is no config or PostCSS is not installed — PostCSS
 * is entirely opt-in, exactly like Vite. The loader is dynamic so projects that
 * don't use PostCSS never pay for it.
 */
export async function loadPostcss(root: string): Promise<PostcssRunner | null> {
  const { default: load } = await import("postcss-load-config");
  let config: Awaited<ReturnType<typeof load>>;
  try {
    config = await load({}, root);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/No PostCSS Config found|Cannot find (module|package)/i.test(message)) {
      return null;
    }
    throw new BuildError(`Failed to load PostCSS config: ${message}`, {
      cause: error,
    });
  }

  const { default: postcss } = await import("postcss");
  const processor = postcss(config.plugins);
  return async (css, from) => {
    const result = await processor.process(css, { ...config.options, from });
    return result.css;
  };
}

/** The result of processing one stylesheet. */
export interface ProcessedStyle {
  /** Final CSS (preprocessed, transformed, url()s rewritten, minified). */
  css: string;
  /** Source map (JSON string) when source maps are enabled, else `null`. */
  map: string | null;
  /** CSS-module class map (`original → scoped`), when the file is a module. */
  exports?: Record<string, string>;
}

/** Lazily imports an optional preprocessor, with a helpful error if missing. */
async function importOptional(name: string, forExt: string): Promise<unknown> {
  try {
    return await import(name);
  } catch {
    throw new BuildError(
      `"${name}" is required to compile ${forExt} files. Install it (e.g. \`pnpm add -D ${name}\`).`,
    );
  }
}

/** Compiles a preprocessor file (or reads plain CSS) to a CSS string. */
async function preprocess(file: string, ext: string): Promise<string> {
  if (ext === ".scss" || ext === ".sass") {
    const sass = (await importOptional("sass", ".scss/.sass")) as {
      compile(file: string, options?: unknown): { css: string };
    };
    return sass.compile(file, { style: "expanded" }).css;
  }
  if (ext === ".less") {
    const less = (
      (await importOptional("less", ".less")) as {
        default: { render(input: string, options?: unknown): Promise<{ css: string }> };
      }
    ).default;
    const out = await less.render(await readFile(file, "utf8"), { filename: file });
    return out.css;
  }
  return readFile(file, "utf8");
}

/**
 * Processes one stylesheet end-to-end: preprocess → lightningcss (CSS modules,
 * `url()` analysis, minification, nesting) → emit + rewrite `url()` assets that
 * live under `rootDir`. External and public `url()`s are left untouched.
 */
export async function processStyle(
  file: string,
  options: StyleOptions,
): Promise<ProcessedStyle> {
  const clean = stripQuery(file);

  // `bundleAsync` inlines `@import`; every file in the graph (entry and
  // imported) is read through the resolver so it goes through the preprocessor
  // and PostCSS first.
  let result;
  try {
    result = await bundleAsync({
      filename: clean,
      minify: options.minify,
      sourceMap: Boolean(options.sourcemap),
      analyzeDependencies: true,
      cssModules: isCssModule(clean),
      resolver: {
        read: async (filePath) => {
          let css = await preprocess(filePath, extname(filePath).toLowerCase());
          if (options.postcss) css = await options.postcss(css, filePath);
          return css;
        },
        resolve: (specifier, from) =>
          options.resolver?.alias(specifier) ?? resolve(dirname(from), specifier),
      },
    });
  } catch (error) {
    throw new BuildError(
      `Failed to process ${basename(clean)}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  let css = result.code.toString();
  const map = result.map ? result.map.toString() : null;
  // Canonicalise `rootDir` once (not per url()) — robust to symlinked roots.
  const rootReal = await realpath(options.paths.rootDir).catch(
    () => options.paths.rootDir,
  );
  for (const dep of result.dependencies ?? []) {
    if (dep.type === "url") {
      // Resolve relative to the file the url() actually appears in.
      const fromDir = dirname(dep.loc.filePath);
      const target = await resolveStyleUrl(dep.url, fromDir, options, rootReal);
      if (target) {
        const fileName = await emitHashedAsset(
          options.outDir,
          options.assetsDir,
          basename(target),
          await readFile(target),
        );
        css = css.replaceAll(dep.placeholder, `${options.base}${fileName}`);
      } else {
        css = css.replaceAll(dep.placeholder, dep.url);
      }
    } else if (dep.type === "import") {
      // `@import` of an unresolved/external sheet: keep the original URL.
      css = css.replaceAll(dep.placeholder, dep.url);
    }
  }

  const exports = result.exports
    ? Object.fromEntries(
        Object.entries(result.exports).map(([key, value]) => [key, value.name]),
      )
    : undefined;

  return exports ? { css, map, exports } : { css, map };
}

/**
 * Emits a stylesheet (and its source map, per the configured strategy) into the
 * output directory, returning the hashed file name relative to `outDir`.
 *
 * The four strategies match `build.sourcemap`:
 * - `false` — CSS only.
 * - `true` — external `.css.map` + a `sourceMappingURL` comment.
 * - `"inline"` — the map appended as a base64 data-URL comment.
 * - `"hidden"` — external `.css.map`, no comment.
 */
export async function emitStyle(
  options: Pick<StyleOptions, "outDir" | "assetsDir" | "sourcemap">,
  sourceName: string,
  css: string,
  map: string | null,
): Promise<string> {
  const base = basename(sourceName, extname(sourceName)) || "style";
  const fileName = `${options.assetsDir}/${base}-${contentHash(css)}.css`;
  const sm = options.sourcemap;

  let output = css;
  if (map && sm === "inline") {
    const data = Buffer.from(map).toString("base64");
    output += `\n/*# sourceMappingURL=data:application/json;base64,${data} */`;
  } else if (map && sm === true) {
    output += `\n/*# sourceMappingURL=${basename(fileName)}.map */`;
  }

  const target = join(options.outDir, fileName);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, output);
  if (map && (sm === true || sm === "hidden")) {
    await writeFile(`${target}.map`, map);
  }
  return fileName;
}

/**
 * Resolves a `url()` to an existing source file under `rootDir`, else `null`
 * (leaving the URL untouched). Comparison goes through `realpath` so it is
 * robust to symlinked temp/roots (e.g. macOS `/var` → `/private/var`).
 */
async function resolveStyleUrl(
  url: string,
  fromDir: string,
  options: StyleOptions,
  rootReal: string,
): Promise<string | null> {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || /^(?:data:|#)/i.test(url)) return null;

  const clean = url.split(/[?#]/, 1)[0] ?? url;
  const aliased = options.resolver?.alias(clean);
  let candidate: string;
  if (aliased) {
    candidate = aliased;
  } else if (url.startsWith("/")) {
    return null; // absolute → public asset, left untouched
  } else {
    candidate = resolve(fromDir, clean);
  }

  const real = await realpath(candidate).catch(() => null);
  if (!real) return null;
  return isWithin(rootReal, real) ? real : null;
}

/** A tiny runtime snippet that injects a stylesheet `<link>` once. */
function cssLoaderSnippet(href: string): string {
  const h = JSON.stringify(href);
  return (
    `(function(){try{var d=document;if(!d.querySelector('link[href='+JSON.stringify(${h})+']')){` +
    `var l=d.createElement("link");l.rel="stylesheet";l.href=${h};d.head.appendChild(l);}}catch(e){}})();`
  );
}

/**
 * Internal bundler plugin implementing the CSS pipeline.
 *
 * `load` runs {@link processStyle} on every stylesheet (returning the class map
 * for CSS modules, or an inert module otherwise) and keeps the CSS per module.
 * `generateBundle` concatenates each chunk's CSS in execution order, emits a
 * hashed `.css`, and either records it for the HTML (entry chunks) or injects a
 * loader so the CSS arrives with its async chunk (code-split chunks).
 */
export function cssPlugin(
  options: StyleOptions,
  cssByEntry: Map<string, string>,
): Plugin {
  const cssByModule = new Map<string, string>();
  const mapByModule = new Map<string, string | null>();

  return {
    name: "vantris:css",
    async load(id) {
      const file = stripQuery(id);
      if (!isStyle(file)) return null;

      const { css, map, exports } = await processStyle(file, options);
      cssByModule.set(id, css);
      mapByModule.set(id, map);

      const code = exports
        ? `export default ${JSON.stringify(exports)};`
        : "export default {};";
      return { code, moduleType: "js", moduleSideEffects: "no-treeshake" };
    },
    async generateBundle(_outputOptions, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName];
        if (!chunk || chunk.type !== "chunk") continue;

        const cssModules = chunk.moduleIds.filter((id) => cssByModule.has(id));
        if (cssModules.length === 0) continue;

        const css = cssModules.map((id) => cssByModule.get(id)!).join("\n");
        // A combined source map is only emitted when a single stylesheet feeds
        // the chunk (the common case); concatenated sheets ship without one
        // rather than a misaligned map.
        const map =
          cssModules.length === 1 ? mapByModule.get(cssModules[0]!) ?? null : null;

        const cssFile = await emitStyle(options, `${chunk.name}.css`, css, map);

        if (chunk.isEntry) {
          cssByEntry.set(chunk.name, cssFile);
        } else {
          // Code-split chunk: load its CSS when the chunk executes.
          chunk.code = cssLoaderSnippet(`${options.base}${cssFile}`) + chunk.code;
        }
      }
    },
  };
}
