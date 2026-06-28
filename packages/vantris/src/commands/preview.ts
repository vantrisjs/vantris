import { relative } from "node:path";
import type { Command } from "../types/command.js";
import { startPreviewServer } from "../preview/index.js";
import { waitForShutdown } from "./support.js";

/** `vantris preview` — serve the production build from `outDir` locally. */
export const preview: Command = {
  name: "preview",
  description: "Locally preview a production build",
  async run(ctx) {
    const log = ctx.logger;
    const server = await startPreviewServer({ ctx });

    log.info(`preview ready in ${server.startupMs}ms`);
    log.info(`  local:   ${server.url}`);
    if (server.networkUrl) log.info(`  network: ${server.networkUrl}`);
    log.info(`  serving: ${relative(ctx.config.paths.root, server.root) || "."}`);

    await waitForShutdown();

    log.info("shutting down…");
    await server.close();
  },
};
