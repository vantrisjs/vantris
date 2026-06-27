import type { Context } from "../types/context.js";
import type { Logger } from "../types/logger.js";
import { loadConfig } from "../config/load.js";
import { resolveConfig } from "../config/resolve.js";

export interface CreateContextOptions {
  /** Working directory the command was invoked from. */
  cwd: string;
  /** Injected logger. */
  logger: Logger;
  /** Optional explicit config file path. */
  configFile?: string;
}

/**
 * Builds the {@link Context} shared by every command: it loads the user config,
 * applies defaults, resolves paths, and bundles the injected services.
 *
 * Centralising construction here means commands never reach for global state —
 * everything they need arrives through the returned context.
 */
export async function createContext(
  options: CreateContextOptions,
): Promise<Context> {
  const { cwd, logger } = options;

  const loaded = await loadConfig({
    cwd,
    logger,
    ...(options.configFile !== undefined
      ? { configFile: options.configFile }
      : {}),
  });

  const config = resolveConfig(loaded.config, cwd, loaded.file);

  return { cwd, config, logger };
}
