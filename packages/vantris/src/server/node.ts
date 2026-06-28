import { createServer, type Server as HttpServer } from "node:http";
import { H3, toNodeHandler } from "h3";
import type { H3Event } from "h3";
import { ServerError } from "../shared/errors.js";

export type { HttpServer };

/** A catch-all HTTP handler returning a web `Response`. */
export type RequestHandler = (event: H3Event) => Promise<Response> | Response;

/**
 * Builds an H3 app routed entirely through `handler`, wrapped in a Node HTTP
 * server (not yet listening). Shared by the dev and preview servers so the
 * routing/lifecycle plumbing lives in exactly one place.
 */
export function createNodeServer(handler: RequestHandler): HttpServer {
  const app = new H3();
  app.all("/", handler);
  app.all("/**", handler);
  return createServer(toNodeHandler(app));
}

/**
 * Starts listening; resolves with the actually-bound port (important when
 * `port` is `0`, i.e. OS-assigned).
 *
 * @throws {ServerError} when the port is already in use.
 */
export function listen(
  server: HttpServer,
  port: number,
  host: string,
): Promise<number> {
  return new Promise((resolveListen, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.removeListener("error", onError);
      reject(
        error.code === "EADDRINUSE"
          ? new ServerError(`Port ${port} is already in use.`, { cause: error })
          : error,
      );
    };
    server.once("error", onError);
    server.listen(port, host, () => {
      server.removeListener("error", onError);
      const address = server.address();
      resolveListen(
        typeof address === "object" && address ? address.port : port,
      );
    });
  });
}

/** Closes an HTTP server, resolving once it has fully shut down. */
export function closeServer(server: HttpServer): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

/** Builds the local URL for a host/port. */
export function localUrl(host: string, port: number): string {
  return `http://${host}:${port}/`;
}
