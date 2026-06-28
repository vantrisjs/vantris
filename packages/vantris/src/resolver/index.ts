import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import type {
  AliasEntry,
  ResolvedResolveConfig,
} from "../types/config-resolved.js";
import { isFile } from "../utils/fs.js";

/**
 * The central module resolver. There is exactly **one** implementation — dev,
 * build, HTML, and CSS all go through it, so aliasing behaves identically
 * everywhere and is never duplicated. It is independent of the dev server and
 * the build pipeline.
 */
export interface Resolver {
  /** Configured alias entries (longest-`find`-first). */
  readonly aliases: readonly AliasEntry[];

  /**
   * Applies alias substitution to a specifier. Returns the rewritten
   * (absolute) path, or `null` when no alias matches. Pure and synchronous.
   */
  alias(specifier: string): string | null;

  /**
   * Resolves a specifier to an existing file on disk, applying aliases and
   * trying the configured extensions (and `index.*`). Returns `null` for bare
   * (node_modules) specifiers and unresolved paths.
   */
  resolveFile(specifier: string, importer?: string): Promise<string | null>;
}

/** Creates a {@link Resolver} from the resolved configuration. */
export function createResolver(config: ResolvedResolveConfig): Resolver {
  const { alias: aliases, extensions } = config;

  const applyAlias = (specifier: string): string | null => {
    for (const { find, replacement } of aliases) {
      if (specifier === find) return replacement;
      if (specifier.startsWith(`${find}/`)) {
        return replacement + specifier.slice(find.length);
      }
    }
    return null;
  };

  const tryExtensions = async (target: string): Promise<string | null> => {
    if (await isFile(target)) return target;
    if (extname(target)) return null;
    for (const ext of extensions) {
      if (await isFile(`${target}${ext}`)) return `${target}${ext}`;
    }
    for (const ext of extensions) {
      const indexed = join(target, `index${ext}`);
      if (await isFile(indexed)) return indexed;
    }
    return null;
  };

  return {
    aliases,
    alias: applyAlias,
    async resolveFile(specifier, importer) {
      const aliased = applyAlias(specifier);
      let target: string | null = aliased;
      if (!target) {
        if (isAbsolute(specifier)) target = specifier;
        else if (specifier.startsWith(".") && importer) {
          target = resolve(dirname(importer), specifier);
        } else {
          return null; // bare specifier — left to the bundler/runtime
        }
      }
      return tryExtensions(target);
    },
  };
}
