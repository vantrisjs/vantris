import type { ResolvedConfig } from "./config-resolved.js";
import type { Logger } from "./logger.js";

/**
 * The execution context threaded into every command.
 *
 * It bundles the resolved configuration and the injected services a command
 * may need. Commands receive everything they depend on through this object —
 * there is no hidden global state — which keeps them pure and testable.
 */
export interface Context {
  /** Absolute working directory the invocation started from. */
  readonly cwd: string;
  /** Resolved configuration (defaults applied, paths absolute). */
  readonly config: ResolvedConfig;
  /** Injected logger. */
  readonly logger: Logger;
}
