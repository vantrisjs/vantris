import type { Command } from "../types/command.js";
import { startDevServer } from "../server/index.js";
import { inspectProject, prepareDirectories } from "./support.js";

/** `vantris dev` — start the development server. */
export const dev: Command = {
  name: "dev",
  description: "Start the development server",
  async run(ctx) {
    const { rootDir, publicDir } = ctx.config.paths;
    await prepareDirectories(ctx, [rootDir, publicDir]);

    const entry = await inspectProject(ctx);
    await startDevServer({ ctx, entry });
  },
};
