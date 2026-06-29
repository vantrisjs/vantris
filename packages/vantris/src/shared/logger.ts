import type { Logger } from "../types/logger.js";
import { APP_NAME } from "./constants.js";

/** Log levels, from least to most verbose. */
export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

/** Severity ranking: a message prints when its level ≤ the configured level. */
const SEVERITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface LoggerOptions {
  /**
   * Minimum level to print. @default "info"
   * (`info` shows info/warn/error and hides debug.)
   */
  level?: LogLevel;
  /** Shorthand for `level: "debug"`. @default false */
  verbose?: boolean;
  /** Sink for output. Defaults to the console; overridable for tests. */
  sink?: Pick<Console, "log" | "warn" | "error">;
}

const prefix = `[${APP_NAME}]`;

/**
 * Creates the default console-backed {@link Logger}.
 *
 * Output is filtered by {@link LogLevel}; the sink is injectable (so tests can
 * capture output) and the level is a construction-time concern, not global
 * state. Adding a new level is a one-line change to {@link SEVERITY}.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? (options.verbose ? "debug" : "info");
  const threshold = SEVERITY[level];
  const sink = options.sink ?? console;

  const enabled = (lvl: LogLevel): boolean => SEVERITY[lvl] <= threshold;
  const line = (message: string): string => `${prefix} ${message}`;

  return {
    info(message) {
      if (enabled("info")) sink.log(line(message));
    },
    warn(message) {
      if (enabled("warn")) sink.warn(line(message));
    },
    error(message) {
      if (enabled("error")) sink.error(line(message));
    },
    debug(message) {
      if (enabled("debug")) sink.log(line(message));
    },
  };
}
