import type { Logger } from "../types/logger.js";
import { APP_NAME } from "./constants.js";

export interface LoggerOptions {
  /** When `false`, `debug` calls are dropped. @default false */
  verbose?: boolean;
  /** Sink for output. Defaults to the console; overridable for tests. */
  sink?: Pick<Console, "log" | "warn" | "error">;
}

const prefix = `[${APP_NAME}]`;

/**
 * Creates the default console-backed {@link Logger}.
 *
 * The sink is injectable so tests can capture output, and verbosity is a
 * construction-time concern rather than a global flag.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const { verbose = false, sink = console } = options;

  return {
    info(message) {
      sink.log(`${prefix} ${message}`);
    },
    warn(message) {
      sink.warn(`${prefix} ${message}`);
    },
    error(message) {
      sink.error(`${prefix} ${message}`);
    },
    debug(message) {
      if (verbose) sink.log(`${prefix} ${message}`);
    },
  };
}
