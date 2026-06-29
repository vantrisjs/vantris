import { relative } from "node:path";
import type { Command } from "../types/command.js";
import { startPreviewServer } from "../preview/index.js";
import { waitForShutdown } from "./support.js";
import { printServerPanel } from "./ui.js";

/** `vantris preview` — serve the production build from `outDir` locally. */
export const preview: Command = {
  name: "preview",
  description: "Locally preview a production build",
  defaultMode: "production",
  async run(ctx) {
    const server = await startPreviewServer({ ctx });

    printServerPanel(ctx.logger, {
      kind: "preview",
      local: server.url,
      network: server.networkUrl,
      mode: ctx.mode,
      startupMs: server.startupMs,
      serving: relative(ctx.config.paths.root, server.root) || ".",
    });

    await waitForShutdown();
    ctx.logger.info("shutting down…");
    await server.close();
  },
};
