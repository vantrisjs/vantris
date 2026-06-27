import type { Command } from "../types/command.js";
import { runPreview } from "../preview/index.js";
import { inspectProject, prepareDirectories } from "./support.js";

/** `vantris preview` — serve a production build locally. */
export const preview: Command = {
  name: "preview",
  description: "Locally preview a production build",
  async run(ctx) {
    await prepareDirectories(ctx, [ctx.config.paths.outDir]);

    await inspectProject(ctx);
    await runPreview({ ctx });
  },
};
