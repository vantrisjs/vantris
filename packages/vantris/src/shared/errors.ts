/**
 * Base class for all errors thrown intentionally by Vantris. The CLI layer can
 * recognise these and render them cleanly (without a stack trace), while
 * unexpected errors keep their full trace.
 */
export class VantrisError extends Error {
  override readonly name: string = "VantrisError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** Thrown when configuration is missing, malformed, or fails to load. */
export class ConfigError extends VantrisError {
  override readonly name = "ConfigError";
}

/** Thrown when the project's HTML entry cannot be found. */
export class HtmlEntryError extends VantrisError {
  override readonly name = "HtmlEntryError";
}

/** Thrown for functionality declared but not yet implemented in this version. */
export class NotImplementedError extends VantrisError {
  override readonly name = "NotImplementedError";
}

/** Narrowing helper. */
export function isVantrisError(error: unknown): error is VantrisError {
  return error instanceof VantrisError;
}
