import type { Command } from "../types/command.js";
import { runBuild } from "../build/index.js";
import { inspectProject, prepareDirectories } from "./support.js";

/** `vantris build` — produce a production build. */
export const build: Command = {
  name: "build",
  description: "Build the project for production",
  async run(ctx) {
    const { rootDir, publicDir, outDir } = ctx.config.paths;
    await prepareDirectories(ctx, [rootDir, publicDir, outDir]);

    const entry = await inspectProject(ctx);
    await runBuild({ ctx, entry });
  },
};
