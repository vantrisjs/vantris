import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import MagicString from "magic-string";
import { rolldown } from "rolldown";
import type {
  InputOptions,
  OutputOptions,
  Plugin,
  PreRenderedAsset,
  PreRenderedChunk,
  RolldownOutput,
} from "rolldown";
import type { ResolvedConfig } from "../types/config-resolved.js";
import type { AssetFileNames, ChunkFileNames } from "../types/config.js";
import type { Resolver } from "../resolver/index.js";
import { ASSET_EXTENSIONS } from "../shared/constants.js";
import { BuildError } from "../shared/errors.js";
import { cssPlugin, type PostcssRunner } from "./css.js";

const ASSET_EXTENSION_SET = new Set<string>(ASSET_EXTENSIONS);

/** Bundler output items (chunks + assets). */
export type BundleOutput = RolldownOutput["output"];

export interface BundleInput {
  /** Bundler inputs: unique entry name → absolute entry-module path. */
  entries: Record<string, string>;
  /** Resolved Vantris configuration. */
  config: ResolvedConfig;
  /** Central resolver, for alias resolution. */
  resolver: Resolver;
  /** `import.meta.env` replacements (token → JSON literal). */
  define: Record<string, string>;
  /** PostCSS runner for the project, when configured. */
  postcss?: PostcssRunner | null;
}

export interface BundleResult {
  /** All emitted chunks and assets. */
  output: BundleOutput;
  /** Emitted entry-CSS file name (relative to `outDir`), keyed by entry name. */
  cssByEntry: Map<string, string>;
}

/**
 * Bundles the application with Rolldown.
 *
 * This is the **only** module aware of Rolldown: it translates Vantris's
 * resolved configuration into Rolldown's input/output options and hides the
 * bundler entirely from the rest of the system. Rolldown handles bundling,
 * tree shaking, minification, and code splitting.
 *
 * @throws {BuildError} when bundling fails or no entry chunk is produced.
 */
export async function bundle(input: BundleInput): Promise<BundleResult> {
  const { entries, config } = input;
  const { paths, build } = config;

  const cssByEntry = new Map<string, string>();
  const styleOptions = {
    paths,
    outDir: paths.outDir,
    assetsDir: build.assetsDir,
    base: config.base,
    minify: build.minify,
    postcss: input.postcss ?? null,
    resolver: input.resolver,
  };
  const inputOptions: InputOptions = {
    input: entries,
    cwd: paths.root,
    platform: "browser",
    // `import.meta.env.*` is statically replaced.
    transform: { define: input.define },
    // Plugins run in order: alias resolution first, then asset/CSS handling.
    plugins: [
      aliasPlugin(input.resolver),
      assetUrlPlugin(config.base),
      cssPlugin(styleOptions, cssByEntry),
    ],
    // Tree shaking is enabled by default.
  };

  const outputOptions: OutputOptions = {
    dir: paths.outDir,
    format: "es",
    minify: build.minify,
    sourcemap: build.sourcemap,
    entryFileNames: toChunkNames(build.entryFileNames),
    chunkFileNames: toChunkNames(build.chunkFileNames),
    assetFileNames: toAssetNames(build.assetFileNames),
  };

  let result: RolldownOutput;
  try {
    const bundler = await rolldown(inputOptions);
    try {
      result = await bundler.write(outputOptions);
    } finally {
      await bundler.close();
    }
  } catch (cause) {
    throw new BuildError(
      `Bundling failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }

  const hasEntry = result.output.some(
    (item) => item.type === "chunk" && item.isEntry,
  );
  if (!hasEntry) {
    throw new BuildError("Bundler produced no entry chunk.");
  }

  return { output: result.output, cssByEntry };
}

/**
 * Finds the emitted file name of the entry chunk named `name`.
 *
 * @throws {BuildError} when no entry chunk matches.
 */
export function entryFileName(output: BundleOutput, name: string): string {
  const chunk = output.find(
    (item) => item.type === "chunk" && item.isEntry && item.name === name,
  );
  if (!chunk) {
    throw new BuildError(`No output chunk produced for entry "${name}".`);
  }
  return chunk.fileName;
}

/**
 * Adapts a Vantris {@link ChunkFileNames} (string or function over
 * {@link ChunkInfo}) into the bundler's option. When a function is given, the
 * bundler's pre-render data is mapped to Vantris's own info shape so user code
 * never sees a Rolldown type.
 */
function toChunkNames(
  value: ChunkFileNames,
): string | ((chunk: PreRenderedChunk) => string) {
  if (typeof value === "string") return value;
  return (chunk) =>
    value({
      name: chunk.name,
      isEntry: chunk.isEntry,
      isDynamicEntry: chunk.isDynamicEntry,
      facadeModuleId: chunk.facadeModuleId ?? null,
      moduleIds: chunk.moduleIds,
      exports: chunk.exports,
    });
}

/** Adapts a Vantris {@link AssetFileNames} into the bundler's option. */
function toAssetNames(
  value: AssetFileNames,
): string | ((asset: PreRenderedAsset) => string) {
  if (typeof value === "string") return value;
  return (asset) =>
    value({
      names: asset.names,
      originalFileNames: asset.originalFileNames,
    });
}

/**
 * Internal bundler plugin applying the central {@link Resolver}'s aliases, so
 * `import x from "@/foo"` resolves identically to dev/CSS/HTML — one
 * implementation, no duplication.
 */
function aliasPlugin(resolver: Resolver): Plugin {
  return {
    name: "vantris:alias",
    async resolveId(source, importer) {
      if (!resolver.alias(source)) return null;
      return (await resolver.resolveFile(source, importer)) ?? resolver.alias(source);
    },
  };
}

/**
 * Internal bundler plugin that turns asset imports (`import url from "./x.svg"`)
 * into **absolute** URLs prefixed with `base`, so they resolve from any page
 * regardless of where the importing chunk lives.
 *
 * The asset is emitted (and content-hashed) by the bundler; the import returns
 * a placeholder that is swapped for the final `${base}${fileName}` in
 * `renderChunk`, once the hashed name is known. This plugin is entirely
 * internal — it is never part of the public plugin surface.
 */
function assetUrlPlugin(base: string): Plugin {
  const tokens = new Map<string, string>(); // placeholder → referenceId

  return {
    name: "vantris:asset-urls",
    async load(id) {
      const file = id.split("?", 1)[0] ?? id;
      if (!ASSET_EXTENSION_SET.has(extname(file).toLowerCase())) return null;

      const referenceId = this.emitFile({
        type: "asset",
        name: basename(file),
        originalFileName: file,
        source: await readFile(file),
      });
      const token = `__VANTRIS_ASSET_${referenceId}__`;
      tokens.set(token, referenceId);
      return `export default ${JSON.stringify(token)};`;
    },
    renderChunk(code) {
      const magic = new MagicString(code);
      let changed = false;
      for (const [token, referenceId] of tokens) {
        const url = `${base}${this.getFileName(referenceId)}`;
        for (
          let index = code.indexOf(token);
          index !== -1;
          index = code.indexOf(token, index + token.length)
        ) {
          magic.update(index, index + token.length, url);
          changed = true;
        }
      }
      // A real source map keeps debugging accurate even when assets are present.
      return changed
        ? { code: magic.toString(), map: magic.generateMap({ hires: true }) }
        : null;
    },
  };
}
