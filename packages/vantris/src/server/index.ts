import type { Context } from "../types/context.js";
import type { HtmlEntry } from "../types/html.js";

/**
 * Options handed to the dev server. Kept here so the contract is stable before
 * the implementation lands.
 */
export interface DevServerOptions {
  ctx: Context;
  /** The detected HTML entry, when present. */
  entry: HtmlEntry | null;
}

/**
 * Starts the development server.
 *
 * Reserved for a future version (planned: an H3-based server with HMR). The
 * seam exists now so `commands/dev` can already delegate here; only this file
 * changes when the engine is implemented.
 */
export async function startDevServer(options: DevServerOptions): Promise<void> {
  const { ctx } = options;
  ctx.logger.info(
    "dev server is not implemented in v0.1.0 (planned: H3 + HMR).",
  );
}
