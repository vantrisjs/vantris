import type { Command } from "../types/command.js";
import { runBuild } from "../build/index.js";
import { inspectProject } from "./support.js";

/** `vantris build` — produce an optimised production build into `outDir`. */
export const build: Command = {
  name: "build",
  description: "Build the project for production",
  defaultMode: "production",
  async run(ctx) {
    const entry = await inspectProject(ctx);
    await runBuild({ ctx, entry });
  },
};
