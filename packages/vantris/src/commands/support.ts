import { relative } from "node:path";
import type { Context } from "../types/context.js";
import type { HtmlEntry } from "../types/html.js";
import { detectHtmlEntry } from "../html/index.js";
import { ensureDir } from "../utils/fs.js";

/** Renders a path relative to the project root for tidy log output. */
function rel(ctx: Context, target: string): string {
  return relative(ctx.config.paths.root, target) || ".";
}

/**
 * Logs the resolved configuration and detects the HTML entry — the shared
 * preamble every command runs before delegating to its (future) engine.
 *
 * @returns The detected HTML entry, or `null` when none exists.
 */
export async function inspectProject(ctx: Context): Promise<HtmlEntry | null> {
  const { paths, configFile } = ctx.config;

  ctx.logger.info(
    `config: ${configFile ? rel(ctx, configFile) : "defaults (no config file)"}`,
  );
  ctx.logger.info(`rootDir:   ${rel(ctx, paths.rootDir)}`);
  ctx.logger.info(`publicDir: ${rel(ctx, paths.publicDir)}`);
  ctx.logger.info(`outDir:    ${rel(ctx, paths.outDir)}`);

  const entry = await detectHtmlEntry(paths.root);
  if (entry) {
    ctx.logger.info(`html entry: ${rel(ctx, entry.file)}`);
  } else {
    ctx.logger.warn(
      "no index.html found at the project root; nothing to serve yet.",
    );
  }

  return entry;
}

/** Ensures the given directories exist, creating them as needed. */
export async function prepareDirectories(
  ctx: Context,
  dirs: readonly string[],
): Promise<void> {
  for (const dir of dirs) {
    await ensureDir(dir);
    ctx.logger.debug(`prepared directory: ${dir}`);
  }
}

/** Resolves when the process receives an interrupt/terminate signal (Ctrl-C). */
export function waitForShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const onSignal = () => {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      resolve();
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  });
}
