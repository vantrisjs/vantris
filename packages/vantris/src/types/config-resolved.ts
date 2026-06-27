import type { Config } from "./config.js";
import type { ResolvedPaths } from "./paths.js";

/**
 * A {@link Config} after defaults have been applied and paths resolved.
 *
 * This is what the rest of the system consumes. Keeping it separate from the
 * user-facing {@link Config} means defaults and resolution rules can evolve
 * without forcing optionality onto every internal consumer.
 */
export interface ResolvedConfig {
  /** The raw configuration as authored by the user (post-normalisation). */
  readonly raw: Config;
  /** Absolute paths derived from the configuration. */
  readonly paths: ResolvedPaths;
  /** Absolute path of the config file that was loaded, if any. */
  readonly configFile: string | null;
}
