import { createServer, type Server as HttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { H3, getRequestURL, toNodeHandler } from "h3";
import type { H3Event } from "h3";
import type { Context } from "../types/context.js";
import type { HtmlEntry } from "../types/html.js";
import { injectDevClient } from "../html/index.js";
import { createReloadSocket, type ReloadSocket } from "./websocket.js";
import { createStaticLoader } from "./static.js";

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

  const loadAsset = createStaticLoader({
    root: paths.root,
    rootDir: paths.rootDir,
    publicDir: paths.publicDir,
  });
  const entryFile = entry?.file ?? null;

  const app = new H3();
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

  app.all("/", handler);
  app.all("/**", handler);

  const server: HttpServer = createServer(toNodeHandler(app));
  const reload: ReloadSocket = createReloadSocket({ server, logger: ctx.logger });

  await listen(server, dev.port, dev.host);

  const url = `http://${dev.host}:${dev.port}/`;

  return {
    url,
    host: dev.host,
    port: dev.port,
    broadcastReload: () => reload.broadcastReload(),
    async close() {
      await reload.close();
      await new Promise<void>((resolveClose, reject) => {
        server.close((err) => (err ? reject(err) : resolveClose()));
      });
    },
  };
}

/** Promisified `server.listen` with error propagation. */
function listen(server: HttpServer, port: number, host: string): Promise<void> {
  return new Promise((resolveListen, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener("error", onError);
      reject(
        err.code === "EADDRINUSE"
          ? new Error(`Port ${port} is already in use.`)
          : err,
      );
    };
    server.once("error", onError);
    server.listen(port, host, () => {
      server.removeListener("error", onError);
      resolveListen();
    });
  });
}
