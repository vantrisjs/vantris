import { join } from "node:path";
import type { Command } from "../types/command.js";
import type { Context } from "../types/context.js";
import { runBuild } from "../build/index.js";
import { watchBuild } from "../build/watch.js";
import { cacheForContext } from "../cache/index.js";
import { HTML_ENTRY_FILENAME } from "../shared/constants.js";
import { inspectProject, waitForShutdown } from "./support.js";
import { collectOutputs, printBuildSummary } from "./ui.js";

/** `vantris build [--watch]` — produce an optimised production build. */
export const build: Command = {
  name: "build",
  description: "Build the project for production",
  defaultMode: "production",
  async run(ctx, args) {
    const buildOnce = () => runOnce(ctx);

    if (args.includes("--watch") || args.includes("-w")) {
      const { rootDir, publicDir, root } = ctx.config.paths;
      const paths = [rootDir, publicDir, join(root, HTML_ENTRY_FILENAME)];
      await watchBuild(ctx, paths, buildOnce, waitForShutdown);
      return;
    }

    await buildOnce();
  },
};

/** Runs a single build: bundle, summarise, and record build info. */
async function runOnce(ctx: Context): Promise<void> {
  // Library mode has no HTML entry to inspect.
  const entry = ctx.config.build.lib ? null : await inspectProject(ctx);
  const result = await runBuild({ ctx, entry });

  const files = await collectOutputs(result.outDir, ctx.config.paths.root);
  printBuildSummary(ctx.logger, files, result.durationMs);

  // Persist build info (transparent; never blocks the build on failure).
  await cacheForContext(ctx)
    .writeJSON("build/last.json", {
      time: Date.now(),
      mode: ctx.mode,
      durationMs: result.durationMs,
      fileCount: result.fileCount,
      outDir: result.outDir,
    })
    .catch(() => {});
}
