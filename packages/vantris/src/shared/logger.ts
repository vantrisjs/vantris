// The logger now lives in its own module (`src/logger/`); this re-export keeps
// the historical `shared/logger.js` import path stable.
export { createLogger, renderError } from "../logger/index.js";
export type { LoggerOptions, LogLevel } from "../logger/index.js";
