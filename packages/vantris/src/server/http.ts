import type { Server } from "node:http";
import { ServerError } from "../shared/errors.js";

/**
 * Starts listening; resolves with the actually-bound port (important when the
 * requested port is `0`, i.e. OS-assigned). Shared by the dev and preview
 * servers so the listen/error plumbing lives in one place.
 *
 * @throws {ServerError} when the port is already in use.
 */
export function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
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
      resolve(typeof address === "object" && address ? address.port : port);
    });
  });
}

/** Closes an HTTP(S) server, resolving once it has fully shut down. */
export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

/** Builds a local URL for a host/port. */
export function localUrl(host: string, port: number, protocol = "http"): string {
  return `${protocol}://${host}:${port}/`;
}
