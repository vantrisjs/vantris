import { relative } from "node:path";
import type { Context } from "../types/context.js";
import type { HtmlEntry } from "../types/html.js";
import { getRuntime } from "../runtime.js";
import { injectDevClient } from "../html/index.js";
import { buildDefine } from "../env/index.js";
import { cacheForContext } from "../cache/index.js";
import { createStaticLoader } from "./static.js";
import type { AliasUrl } from "./rewrite.js";
import type { Prebundle } from "./prebundle.js";
import { resolveHttps } from "./https.js";
import { createNodeServer } from "./node.js";
import { createBunServer } from "./bun.js";
import type { DevServerHandle, RuntimeServerOptions } from "./shared.js";

export type { DevServerHandle, RuntimeServerOptions } from "./shared.js";

/** Options for {@link createDevServer}. */
export interface DevServerOptions {
  ctx: Context;
  /** The detected HTML entry, when present. */
  entry: HtmlEntry | null;
  /** Pre-bundled dependencies to serve and map bare imports to. */
  prebundle?: Prebundle;
  /** Overrides `dev.host` (e.g. the CLI `--host` flag). */
  host?: string;
  /** Overrides `dev.port`. */
  port?: number;
}

/**
 * Starts the Vantris development server.
 *
 * This is the **single** public entry point: it builds a runtime-agnostic set
 * of options (asset loader, base, HTTPS, CORS, proxy, SPA fallback) and
 * dispatches to the native Node.js or Bun implementation via {@link getRuntime}.
 * No other module imports the runtime servers directly, so the two behave
 * identically from the caller's point of view.
 */
export async function createDevServer(
  options: DevServerOptions,
): Promise<DevServerHandle> {
  const { ctx, entry } = options;
  const { paths, dev, server } = ctx.config;
  const base = server.base;

  const aliases: AliasUrl[] = ctx.resolver.aliases.map(({ find, replacement }) => ({
    find,
    url: `${base}${relative(paths.root, replacement)}`,
  }));

  const loadAsset = createStaticLoader({
    root: paths.root,
    rootDir: paths.rootDir,
    publicDir: paths.publicDir,
    base,
    define: buildDefine(ctx.env, ctx.mode, ctx.config.base, ctx.config.define),
    aliases,
    cache: cacheForContext(ctx),
    ...(options.prebundle
      ? { depsDir: options.prebundle.dir, depsPrefix: options.prebundle.servePrefix, bareImports: options.prebundle.imports }
      : {}),
  });

  const runtimeOptions: RuntimeServerOptions = {
    host: options.host ?? dev.host,
    port: options.port ?? dev.port,
    base,
    https: await resolveHttps(server.https, paths.root, ctx.logger),
    cors: server.cors,
    proxy: server.proxy,
    spaFallback: server.spaFallback,
    logger: ctx.logger,
    loadAsset,
    entryFile: entry?.file ?? null,
    transformHtml: injectDevClient,
  };

  return getRuntime() === "bun"
    ? createBunServer(runtimeOptions)
    : createNodeServer(runtimeOptions);
}

/**
 * @deprecated Use {@link createDevServer}. Kept as an alias so existing
 * programmatic callers (v0.2.0+) keep working unchanged.
 */
export const startDevServer = createDevServer;
