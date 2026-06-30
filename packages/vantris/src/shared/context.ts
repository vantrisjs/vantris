import type { Context } from "../types/context.js";
import type { Config } from "../types/config.js";
import type { Logger } from "../types/logger.js";
import { loadConfig } from "../config/load.js";
import { resolveConfig } from "../config/resolve.js";
import { validateConfig } from "../config/validate.js";
import { readTsconfigAliases } from "../config/tsconfig.js";
import { loadEnv } from "../env/index.js";
import { createResolver } from "../resolver/index.js";
import { resolveFrom } from "../utils/paths.js";
import { DEFAULTS } from "./constants.js";

export interface CreateContextOptions {
  /** Working directory the command was invoked from. */
  cwd: string;
  /** Injected logger. */
  logger: Logger;
  /** Active mode (e.g. `"development"`, `"production"`). @default "development" */
  mode?: string;
  /** Optional explicit config file path. */
  configFile?: string;
}

/**
 * Builds the {@link Context} shared by every command: it loads and validates
 * the user config, applies defaults, loads the mode's `.env` files, and wires
 * the central resolver.
 *
 * Centralising construction here means commands never reach for global state —
 * everything they need (config, mode, env, resolver) arrives through the
 * returned context.
 */
export async function createContext(
  options: CreateContextOptions,
): Promise<Context> {
  const { cwd, logger, mode = "development" } = options;

  const loaded = await loadConfig({
    cwd,
    logger,
    ...(options.configFile !== undefined
      ? { configFile: options.configFile }
      : {}),
  });

  validateConfig(loaded.config);
  const raw = await withTsconfigAliases(loaded.config, cwd, logger);
  const config = resolveConfig(raw, cwd, loaded.file);

  const env = await loadEnv(mode, config.paths.root);
  const resolver = createResolver(config.resolve);

  return { cwd, config, logger, mode, env, resolver };
}

/**
 * Fills `resolve.alias` from `tsconfig.json` (`paths` + `baseUrl`) when the user
 * has not configured any aliases. Explicit Vantris config always wins, so this
 * is a no-op the moment `resolve.alias` is set.
 */
async function withTsconfigAliases(
  raw: Config,
  cwd: string,
  logger: Logger,
): Promise<Config> {
  if (raw.resolve?.alias && Object.keys(raw.resolve.alias).length > 0) {
    return raw;
  }

  const root = resolveFrom(cwd, raw.root ?? DEFAULTS.root);
  const aliases = await readTsconfigAliases(root);
  const count = Object.keys(aliases).length;
  if (count === 0) return raw;

  logger.debug(`aliases: loaded ${count} from tsconfig.json`);
  return { ...raw, resolve: { ...raw.resolve, alias: aliases } };
}
