import { relative } from "node:path";
import type { Command } from "../types/command.js";
import { createDevServer } from "../server/index.js";
import { prebundleDeps } from "../server/prebundle.js";
import { createWatcher } from "../shared/watcher.js";
import {
  inspectProject,
  prepareDirectories,
  waitForShutdown,
} from "./support.js";
import { printServerPanel } from "./ui.js";

/** Coalesce a burst of filesystem events into a single reload. */
const RELOAD_DEBOUNCE_MS = 50;

/** Reads a `--host [value]` / `--host=value` flag (bare flag → all interfaces). */
function parseHost(args: readonly string[]): string | undefined {
  const flag = args.indexOf("--host");
  if (flag !== -1) {
    const next = args[flag + 1];
    return next && !next.startsWith("-") ? next : "0.0.0.0";
  }
  const inline = args.find((arg) => arg.startsWith("--host="));
  return inline ? inline.slice("--host=".length) : undefined;
}

/**
 * `vantris dev` — start the development server.
 *
 * Runtime flow: inspect project → pre-bundle dependencies → start the native
 * dev server (HTTP/HTTPS + WebSocket) → watch files → live-reload on change.
 * Runs until interrupted (Ctrl-C), then shuts everything down cleanly.
 */
export const dev: Command = {
  name: "dev",
  description: "Start the development server",
  defaultMode: "development",
  async run(ctx, args) {
    const { root, rootDir, publicDir } = ctx.config.paths;
    await prepareDirectories(ctx, [rootDir, publicDir]);

    const entry = await inspectProject(ctx);
    const prebundle = await prebundleDeps(ctx);

    const host = parseHost(args);
    const server = await createDevServer({
      ctx,
      entry,
      prebundle,
      ...(host ? { host } : {}),
    });
    printServerPanel(ctx.logger, {
      kind: "dev",
      local: server.url,
      network: null,
      mode: ctx.mode,
      startupMs: server.startupMs,
    });

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
