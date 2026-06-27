import { relative } from "node:path";
import type { Command } from "../types/command.js";
import { startDevServer } from "../server/index.js";
import { createWatcher } from "../shared/watcher.js";
import { inspectProject, prepareDirectories } from "./support.js";

/** Coalesce a burst of filesystem events into a single reload. */
const RELOAD_DEBOUNCE_MS = 50;

/**
 * `vantris dev` — start the development server.
 *
 * Runtime flow: load config (via context) → inspect project → init dev server
 * (HTTP + WebSocket) → start the file watcher → trigger live reload on change.
 * Runs until interrupted (Ctrl-C), then shuts everything down cleanly.
 */
export const dev: Command = {
  name: "dev",
  description: "Start the development server",
  async run(ctx) {
    const { root, rootDir, publicDir } = ctx.config.paths;
    await prepareDirectories(ctx, [rootDir, publicDir]);

    const entry = await inspectProject(ctx);

    const server = await startDevServer({ ctx, entry });
    ctx.logger.info(`ready — dev server running at ${server.url}`);

    let timer: NodeJS.Timeout | undefined;
    const watcher = createWatcher({
      dir: rootDir,
      logger: ctx.logger,
      onChange: ({ kind, file }) => {
        ctx.logger.info(`${kind}: ${relative(root, file)} — reloading`);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => server.broadcastReload(), RELOAD_DEBOUNCE_MS);
      },
    });

    await waitForShutdown();

    ctx.logger.info("shutting down…");
    if (timer) clearTimeout(timer);
    await watcher.close();
    await server.close();
  },
};

/** Resolves when the process receives an interrupt/terminate signal. */
function waitForShutdown(): Promise<void> {
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
