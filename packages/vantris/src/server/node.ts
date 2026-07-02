import { createServer as createHttp } from "node:http";
import { createServer as createHttps } from "node:https";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { Logger } from "../types/logger.js";
import { closeServer, listen } from "./http.js";
import { createReloadHub } from "./websocket.js";
import { corsHeaders, isPreflight } from "./cors.js";
import { matchProxy, proxyFetch, ProxyError, proxyTargetUrl } from "./proxy.js";
import {
  HOP_BY_HOP,
  serveApp,
  stripBase,
  type DevServerHandle,
  type RuntimeServerOptions,
} from "./shared.js";

/**
 * A connect-style middleware. Middlewares run in order; each either responds
 * (ending `res`) or calls `next()` to defer. This pipeline is the seam the
 * future plugin API (v1.x) will hook into — built-in behaviour (CORS, proxy,
 * static serving) is expressed as middlewares here.
 */
type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

/**
 * The native Node.js dev server: `node:http` (or `node:https`) plus a
 * middleware pipeline and a hand-rolled WebSocket upgrade for live reload. No
 * external HTTP or WebSocket dependency.
 */
export async function createNodeServer(
  options: RuntimeServerOptions,
): Promise<DevServerHandle> {
  const { logger } = options;
  const started = Date.now();
  const hub = createReloadHub(logger);

  const middlewares: Middleware[] = [];
  if (options.cors) middlewares.push(corsMiddleware(options.cors));
  if (options.proxy.length > 0) middlewares.push(proxyMiddleware(options));
  middlewares.push(appMiddleware(options));

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    runPipeline(middlewares, req, res, logger);
  };

  const server: Server = options.https
    ? createHttps({ cert: options.https.cert, key: options.https.key }, handler)
    : createHttp(handler);

  // Live-reload WebSocket shares the HTTP port via the `upgrade` event.
  server.on("upgrade", (req, socket) => hub.handleUpgrade(req, socket as Duplex));

  const port = await listen(server, options.port, options.host);
  const protocol = options.https ? "https" : "http";

  return {
    url: `${protocol}://${options.host}:${port}${options.base}`,
    host: options.host,
    port,
    https: Boolean(options.https),
    startupMs: Date.now() - started,
    broadcastReload: () => hub.broadcastReload(),
    async close() {
      await hub.close();
      await closeServer(server);
    },
  };
}

/** Runs the middleware pipeline, ending in a 404 if nothing responded. */
function runPipeline(
  middlewares: readonly Middleware[],
  req: IncomingMessage,
  res: ServerResponse,
  logger: Logger,
): void {
  let index = 0;
  const next = (): void => {
    const middleware = middlewares[index++];
    if (!middleware) {
      notFound(req, res);
      return;
    }
    try {
      middleware(req, res, next);
    } catch (error) {
      serverError(res, error, logger);
    }
  };
  next();
}

/** CORS middleware: adds headers and short-circuits preflight requests. */
function corsMiddleware(cors: NonNullable<RuntimeServerOptions["cors"]>): Middleware {
  return (req, res, next) => {
    const headers = corsHeaders(cors, req.headers.origin);
    if (headers) {
      for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    }
    if (isPreflight(req.method ?? "GET", req.headers["access-control-request-method"] as string | undefined)) {
      res.writeHead(204);
      res.end();
      return;
    }
    next();
  };
}

/** Proxy middleware: forwards matched requests to their target via `fetch`. */
function proxyMiddleware(options: RuntimeServerOptions): Middleware {
  return (req, res, next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const rule = matchProxy(options.proxy, url.pathname);
    if (!rule) {
      next();
      return;
    }

    readBody(req)
      .then(async (body) => {
        const target = proxyTargetUrl(rule, url.pathname, url.search);
        const upstream = await proxyFetch(rule, target, {
          method: req.method ?? "GET",
          headers: nodeHeaders(req),
          body,
        });
        const payload = Buffer.from(await upstream.arrayBuffer());
        const headers: Record<string, string> = {};
        upstream.headers.forEach((value, key) => {
          if (!HOP_BY_HOP.has(key.toLowerCase())) headers[key] = value;
        });
        res.writeHead(upstream.status, headers);
        res.end(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof ProxyError) {
          options.logger.error(error.message);
          res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
          res.end(error.message);
        } else {
          serverError(res, error, options.logger);
        }
      });
  };
}

/** App middleware: serves static assets and the SPA fallback. */
function appMiddleware(options: RuntimeServerOptions): Middleware {
  return (req, res, next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = stripBase(decodeURIComponent(url.pathname), options.base);
    serveApp(pathname, options)
      .then((served) => {
        if (!served) {
          next();
          return;
        }
        res.writeHead(served.status, served.headers);
        res.end(served.body);
      })
      .catch((error: unknown) => serverError(res, error, options.logger));
  };
}

function notFound(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end(`404 Not Found: ${req.url ?? ""}`);
}

function serverError(res: ServerResponse, error: unknown, logger: Logger): void {
  logger.error(`server error: ${error instanceof Error ? error.message : String(error)}`);
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
  res.end("500 Internal Server Error");
}

/** Reads a request body into a buffer (skipped for GET/HEAD). */
function readBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Flattens Node's header map to `Record<string, string>`. */
function nodeHeaders(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers[key] = value;
    else if (Array.isArray(value)) headers[key] = value.join(", ");
  }
  return headers;
}
