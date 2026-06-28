import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { getRequestURL } from "h3";
import type { H3Event } from "h3";
import type { Context } from "../types/context.js";
import type { HtmlEntry } from "../types/html.js";
import { injectDevClient } from "../html/index.js";
import { envDefine } from "../env/index.js";
import { createReloadSocket, type ReloadSocket } from "./websocket.js";
import { createStaticLoader } from "./static.js";
import type { AliasUrl } from "./rewrite.js";
import { closeServer, createNodeServer, listen, localUrl } from "./node.js";

/** Options for {@link startDevServer}. */
export interface DevServerOptions {
  ctx: Context;
  /** The detected HTML entry, when present. */
  entry: HtmlEntry | null;
}

/** A running dev server. */
export interface DevServerHandle {
  /** Address the server is listening on, e.g. `http://localhost:3000/`. */
  readonly url: string;
  readonly host: string;
  readonly port: number;
  /** Pushes a full-page reload to every connected browser. */
  broadcastReload(): void;
  /** Stops the HTTP and WebSocket servers. */
  close(): Promise<void>;
}

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-cache",
} as const;

/**
 * Starts the H3-based development server.
 *
 * Responsibilities are split across the `server` module: this file owns the
 * HTTP routing (H3) and lifecycle, {@link createStaticLoader} owns file
 * resolution + transpilation, and {@link createReloadSocket} owns live reload.
 * The HTTP and WebSocket servers share a single port.
 */
export async function startDevServer(
  options: DevServerOptions,
): Promise<DevServerHandle> {
  const { ctx, entry } = options;
  const { paths, dev } = ctx.config;

  const aliases: AliasUrl[] = ctx.resolver.aliases.map(({ find, replacement }) => ({
    find,
    url: `/${relative(paths.root, replacement)}`,
  }));
  const loadAsset = createStaticLoader({
    root: paths.root,
    rootDir: paths.rootDir,
    publicDir: paths.publicDir,
    define: envDefine(ctx.env, ctx.mode, ctx.config.base),
    aliases,
  });
  const entryFile = entry?.file ?? null;

  const handler = async (event: H3Event) => {
    const { pathname } = getRequestURL(event);

    // 1. A real file on disk (transpiled if it's TypeScript/JSX).
    const asset = await loadAsset(pathname);
    if (asset) {
      if (asset.isHtml) {
        return new Response(injectDevClient(asset.body as string), {
          headers: HTML_HEADERS,
        });
      }
      return new Response(asset.body, {
        headers: { "content-type": asset.contentType, "cache-control": "no-cache" },
      });
    }

    // 2. Anything else falls back to the HTML entry. Root files
    //    (package.json, configs, node_modules, …) are never read — they are
    //    outside the served allowlist — so the client only ever gets index.html.
    if (entryFile) {
      const html = await readFile(entryFile, "utf8");
      return new Response(injectDevClient(html), { headers: HTML_HEADERS });
    }

    // 3. No HTML entry exists yet.
    return new Response(`404 Not Found: ${pathname}`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  };

  const server = createNodeServer(handler);
  const reload: ReloadSocket = createReloadSocket({ server, logger: ctx.logger });

  // The actual bound port — important when `port` is 0 (OS-assigned).
  const port = await listen(server, dev.port, dev.host);

  return {
    url: localUrl(dev.host, port),
    host: dev.host,
    port,
    broadcastReload: () => reload.broadcastReload(),
    async close() {
      await reload.close();
      await closeServer(server);
    },
  };
}
