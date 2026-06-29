import type { Command } from "../types/command.js";
import { runBuild } from "../build/index.js";
import { inspectProject } from "./support.js";
import { collectOutputs, printBuildSummary } from "./ui.js";

/** `vantris build` — produce an optimised production build into `outDir`. */
export const build: Command = {
  name: "build",
  description: "Build the project for production",
  defaultMode: "production",
  async run(ctx) {
    const entry = await inspectProject(ctx);
    const result = await runBuild({ ctx, entry });

    const files = await collectOutputs(result.outDir, ctx.config.paths.root);
    printBuildSummary(ctx.logger, files, result.durationMs);
  },
};
