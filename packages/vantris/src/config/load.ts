import { pathToFileURL } from "node:url";
import type { Config, ConfigInput } from "../types/config.js";
import type { Logger } from "../types/logger.js";
import { CONFIG_FILENAMES } from "../shared/constants.js";
import { ConfigError } from "../shared/errors.js";
import { isFile } from "../utils/fs.js";
import { resolveFrom } from "../utils/paths.js";

export interface LoadConfigOptions {
  /** Directory to search for a config file. */
  cwd: string;
  /** Logger for diagnostics. */
  logger: Logger;
  /** Explicit config file path; bypasses filename discovery. */
  configFile?: string;
}

export interface LoadedConfig {
  /** Parsed configuration. Empty object when no config file is present. */
  config: Config;
  /** Absolute path of the file that was loaded, or `null` when none. */
  file: string | null;
}

/**
 * Locates and loads a `vantris.config.*` file from `cwd`.
 *
 * The actual module evaluation is isolated here so the loading strategy
 * (native TS stripping today; a bundled loader such as esbuild/jiti later)
 * can change without affecting any caller. A missing config is not an error —
 * defaults take over downstream.
 */
export async function loadConfig(
  options: LoadConfigOptions,
): Promise<LoadedConfig> {
  const { cwd, logger } = options;

  const file = options.configFile
    ? resolveFrom(cwd, options.configFile)
    : await findConfigFile(cwd);

  if (!file) {
    logger.debug("No config file found; using defaults.");
    return { config: {}, file: null };
  }

  logger.debug(`Loading config from ${file}`);
  const config = await importConfig(file);
  return { config, file };
}

/** Returns the first existing config file in {@link CONFIG_FILENAMES}. */
async function findConfigFile(cwd: string): Promise<string | null> {
  for (const name of CONFIG_FILENAMES) {
    const candidate = resolveFrom(cwd, name);
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Imports a config module and normalises its export to a {@link Config}.
 * Relies on the Node runtime's native TypeScript support for `.ts` files.
 */
async function importConfig(file: string): Promise<Config> {
  let mod: { default?: unknown };
  try {
    // Cache-bust so repeated loads (e.g. a future config-watch mode) re-read.
    const url = `${pathToFileURL(file).href}?t=${Date.now()}`;
    mod = (await import(url)) as { default?: unknown };
  } catch (cause) {
    throw new ConfigError(`Failed to load config file: ${file}`, { cause });
  }

  const exported = mod.default;
  if (exported === undefined) {
    throw new ConfigError(
      `Config file "${file}" has no default export. ` +
        `Export your config with \`export default defineConfig({ ... })\`.`,
    );
  }

  return normalise(exported as ConfigInput, file);
}

/** Resolves a {@link ConfigInput} (object or factory) into a {@link Config}. */
async function normalise(
  input: ConfigInput,
  file: string,
): Promise<Config> {
  const value = typeof input === "function" ? await input() : input;

  if (value === null || typeof value !== "object") {
    throw new ConfigError(
      `Config file "${file}" must export an object (or a function returning one).`,
    );
  }

  return value;
}
