import type { ResolvedConfig } from "./config-resolved.js";
import type { Logger } from "./logger.js";
import type { Resolver } from "../resolver/index.js";

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
  /** Active mode, e.g. `"development"`, `"production"`, or a custom mode. */
  readonly mode: string;
  /** Environment variables loaded for {@link mode} from the `.env` files. */
  readonly env: Record<string, string>;
  /** The central module resolver (aliases + extension resolution). */
  readonly resolver: Resolver;
}
