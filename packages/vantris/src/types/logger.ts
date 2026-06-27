/**
 * Minimal logging contract injected throughout Vantris.
 *
 * Depending on an interface (rather than calling `console` directly) keeps the
 * core testable and lets future versions swap in a richer, level-aware logger
 * without touching call sites.
 */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Verbose diagnostics; may be a no-op depending on configuration. */
  debug(message: string): void;
}
