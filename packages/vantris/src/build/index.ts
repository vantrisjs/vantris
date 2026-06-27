import type { Context } from "../types/context.js";
import type { HtmlEntry } from "../types/html.js";

/** Options handed to the build pipeline. */
export interface BuildOptions {
  ctx: Context;
  /** The detected HTML entry, when present. */
  entry: HtmlEntry | null;
}

/**
 * Produces a production build into `outDir`.
 *
 * Reserved for a future version (planned: Rolldown for bundling, esbuild for
 * transforms). The seam exists now so `commands/build` can already delegate
 * here; only this file changes when the engine is implemented.
 */
export async function runBuild(options: BuildOptions): Promise<void> {
  const { ctx } = options;
  ctx.logger.info(
    "build is not implemented in v0.1.0 (planned: Rolldown + esbuild).",
  );
}
