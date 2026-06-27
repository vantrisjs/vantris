#!/usr/bin/env node
import { createLogger } from "../shared/logger.js";
import { isVantrisError } from "../shared/errors.js";
import { ExitCode, run } from "./run.js";

/**
 * Binary entry point. Owns process concerns only — argv intake, exit codes,
 * and top-level error rendering — and delegates all routing to {@link run}.
 */
async function main(): Promise<void> {
  try {
    const code = await run(process.argv.slice(2));
    process.exitCode = code;
  } catch (error) {
    const logger = createLogger();
    if (isVantrisError(error)) {
      // Expected, user-facing failures: show the message, skip the stack.
      logger.error(error.message);
    } else {
      logger.error("An unexpected error occurred:");
      logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    }
    process.exitCode = ExitCode.Error;
  }
}

void main();
