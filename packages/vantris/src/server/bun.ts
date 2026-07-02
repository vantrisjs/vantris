import { RELOAD_MESSAGE } from "../shared/constants.js";
import { corsHeaders, isPreflight } from "./cors.js";
import { matchProxy, proxyFetch, ProxyError, proxyTargetUrl } from "./proxy.js";
import {
  HOP_BY_HOP,
  serveApp,
  stripBase,
  type DevServerHandle,
  type RuntimeServerOptions,
} from "./shared.js";

// ─── Minimal ambient Bun types ──────────────────────────────────────────────
// Declared inline so the file type-checks without the `@types/bun` package
// (Bun is not a dependency; this path only runs under the Bun runtime).
interface ServerWebSocket {
  send(data: string | Uint8Array): void;
  close(): void;
}
interface BunServer {
  readonly port: number;
  stop(closeActiveConnections?: boolean): void;
  upgrade(request: Request, options?: { data?: unknown }): boolean;
}
interface BunServeOptions {
  port?: number;
  hostname?: string;
  tls?: { cert: string; key: string };
  fetch(request: Request, server: BunServer): Response | undefined | Promise<Response | undefined>;
  websocket?: {
    open?(ws: ServerWebSocket): void;
    message?(ws: ServerWebSocket, message: string | Uint8Array): void;
    close?(ws: ServerWebSocket): void;
  };
}
declare const Bun: { serve(options: BunServeOptions): BunServer };

/**
 * The native Bun dev server: `Bun.serve()` plus Bun's built-in WebSocket
 * (`server.upgrade`). It exposes the same options and handle shape as the Node
 * server, so callers never know which runtime is active.
 */
export function createBunServer(
  options: RuntimeServerOptions,
): Promise<DevServerHandle> {
  const started = Date.now();
  const clients = new Set<ServerWebSocket>();

  const server = Bun.serve({
    port: options.port,
    hostname: options.host,
    ...(options.https ? { tls: { cert: options.https.cert, key: options.https.key } } : {}),
    fetch(request, srv) {
      // Live-reload WebSocket upgrade is handled natively by Bun.
      if (srv.upgrade(request)) return undefined;
      return handleFetch(request, options);
    },
    websocket: {
      open(ws) {
        clients.add(ws);
      },
      close(ws) {
        clients.delete(ws);
      },
      // The channel is server→client only; client messages are ignored.
      message() {},
    },
  });

  const protocol = options.https ? "https" : "http";
  const handle: DevServerHandle = {
    url: `${protocol}://${options.host}:${server.port}${options.base}`,
    host: options.host,
    port: server.port,
    https: Boolean(options.https),
    startupMs: Date.now() - started,
    broadcastReload() {
      for (const ws of clients) ws.send(RELOAD_MESSAGE);
    },
    close() {
      server.stop(true);
      clients.clear();
      return Promise.resolve();
    },
  };
  return Promise.resolve(handle);
}

/** Runs the shared request pipeline (CORS → proxy → app) for one request. */
async function handleFetch(
  request: Request,
  options: RuntimeServerOptions,
): Promise<Response> {
  const url = new URL(request.url);

  let cors: Record<string, string> | null = null;
  if (options.cors) {
    cors = corsHeaders(options.cors, request.headers.get("origin") ?? undefined);
    if (isPreflight(request.method, request.headers.get("access-control-request-method") ?? undefined)) {
      return new Response(null, { status: 204, headers: cors ?? {} });
    }
  }

  const rule = matchProxy(options.proxy, url.pathname);
  if (rule) {
    try {
      const body =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : new Uint8Array(await request.arrayBuffer());
      const target = proxyTargetUrl(rule, url.pathname, url.search);
      const upstream = await proxyFetch(rule, target, {
        method: request.method,
        headers: headerObject(request.headers),
        body,
      });
      const headers = new Headers();
      upstream.headers.forEach((value, key) => {
        if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
      });
      return withCors(new Response(upstream.body, { status: upstream.status, headers }), cors);
    } catch (error) {
      if (error instanceof ProxyError) {
        options.logger.error(error.message);
        return new Response(error.message, { status: 502 });
      }
      throw error;
    }
  }

  const pathname = stripBase(decodeURIComponent(url.pathname), options.base);
  const served = await serveApp(pathname, options);
  if (served) {
    return withCors(new Response(served.body, { status: served.status, headers: served.headers }), cors);
  }
  return withCors(
    new Response(`404 Not Found: ${url.pathname}`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    }),
    cors,
  );
}

/** Flattens `Headers` to a plain object for the proxy `fetch`. */
function headerObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Merges CORS headers into a response, when CORS is enabled. */
function withCors(response: Response, cors: Record<string, string> | null): Response {
  if (!cors) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}
