import type { Context } from "../types/context.js";
import type { Logger } from "../types/logger.js";
import { loadConfig } from "../config/load.js";
import { resolveConfig } from "../config/resolve.js";
import { validateConfig } from "../config/validate.js";
import { loadEnv } from "../env/index.js";
import { createResolver } from "../resolver/index.js";

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
  const config = resolveConfig(loaded.config, cwd, loaded.file);

  const env = await loadEnv(mode, config.paths.root);
  const resolver = createResolver(config.resolve);

  return { cwd, config, logger, mode, env, resolver };
}
