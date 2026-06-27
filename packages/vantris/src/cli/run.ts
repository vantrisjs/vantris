import type { Logger } from "../types/logger.js";
import { commands } from "../commands/index.js";
import { createContext } from "../shared/context.js";
import { createLogger } from "../shared/logger.js";
import { helpText, versionText } from "./help.js";

export interface RunOptions {
  /** Working directory; defaults to `process.cwd()`. */
  cwd?: string;
  /** Logger override, primarily for tests. */
  logger?: Logger;
}

/** Process exit codes used by the CLI. */
export const enum ExitCode {
  Ok = 0,
  Error = 1,
}

/**
 * Parses arguments and routes to a command. This is the entire CLI surface:
 * it owns argument handling and dispatch only — never command behaviour, which
 * lives behind the {@link commands} registry.
 *
 * @returns A process exit code.
 */
export async function run(
  argv: readonly string[],
  options: RunOptions = {},
): Promise<ExitCode> {
  const verbose = argv.includes("--verbose") || argv.includes("--debug");
  const logger = options.logger ?? createLogger({ verbose });
  const cwd = options.cwd ?? process.cwd();

  const [first, ...rest] = argv.filter((arg) => !isGlobalFlag(arg));

  if (!first || first === "--help" || first === "-h" || first === "help") {
    logger.info(helpText());
    return ExitCode.Ok;
  }

  if (first === "--version" || first === "-v") {
    logger.info(versionText());
    return ExitCode.Ok;
  }

  const command = commands[first];
  if (!command) {
    logger.error(`Unknown command: "${first}"`);
    logger.info(helpText());
    return ExitCode.Error;
  }

  const ctx = await createContext({ cwd, logger });
  await command.run(ctx, rest);
  return ExitCode.Ok;
}

/** Flags handled by the runner itself rather than passed to commands. */
function isGlobalFlag(arg: string): boolean {
  return arg === "--verbose" || arg === "--debug";
}
