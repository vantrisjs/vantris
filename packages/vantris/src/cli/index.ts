#!/usr/bin/env node
import { renderError } from "../logger/index.js";
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
    const verbose =
      process.argv.includes("--verbose") || process.argv.includes("--debug");
    process.stderr.write(`${renderError(error, verbose)}\n`);
    process.exitCode = ExitCode.Error;
  }
}

void main();
