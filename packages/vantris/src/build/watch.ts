import { relative } from "node:path";
import type { Context } from "../types/context.js";
import { createWatcher } from "../shared/watcher.js";
import { isVantrisError } from "../shared/errors.js";

/** Coalesce a burst of filesystem events into a single rebuild. */
const REBUILD_DEBOUNCE_MS = 80;

/**
 * Watches `paths` and re-runs `build` on every change (debounced), **without**
 * starting a dev server — it only rebuilds. A failed build is reported but
 * never stops the watcher, and overlapping triggers are coalesced so a rebuild
 * never runs concurrently with itself. Runs until the process is interrupted.
 *
 * @param waitForShutdown Resolves on Ctrl-C / SIGTERM (injected to avoid a
 *                        dependency cycle with the command layer).
 */
export async function watchBuild(
  ctx: Context,
  paths: string[],
  build: () => Promise<void>,
  waitForShutdown: () => Promise<void>,
): Promise<void> {
  const { root } = ctx.config.paths;

  const safeBuild = async (): Promise<void> => {
    try {
      await build();
    } catch (error) {
      ctx.logger.error(isVantrisError(error) ? error.message : String(error));
    }
  };

  await safeBuild();
  ctx.logger.info("watching for changes — press Ctrl-C to stop");

  let timer: NodeJS.Timeout | undefined;
  let running = false;
  let pending = false;

  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(trigger, REBUILD_DEBOUNCE_MS);
  };
  const trigger = async (): Promise<void> => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    await safeBuild();
    running = false;
    if (pending) {
      pending = false;
      schedule();
    }
  };

  const watcher = createWatcher({
    dir: paths,
    logger: ctx.logger,
    onChange: ({ kind, file }) => {
      ctx.logger.info(`${kind}: ${relative(root, file) || "."}`);
      schedule();
    },
  });

  await waitForShutdown();
  ctx.logger.info("shutting down…");
  if (timer) clearTimeout(timer);
  await watcher.close();
}
