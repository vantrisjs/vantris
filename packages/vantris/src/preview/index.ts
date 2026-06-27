import type { Context } from "../types/context.js";

/** Options handed to the preview server. */
export interface PreviewOptions {
  ctx: Context;
}

/**
 * Serves a previously produced production build from `outDir`.
 *
 * Reserved for a future version (planned: a static server over the build
 * output). The seam exists now so `commands/preview` can already delegate
 * here; only this file changes when the engine is implemented.
 */
export async function runPreview(options: PreviewOptions): Promise<void> {
  const { ctx } = options;
  ctx.logger.info(
    "preview is not implemented in v0.1.0 (planned: static server over outDir).",
  );
}
