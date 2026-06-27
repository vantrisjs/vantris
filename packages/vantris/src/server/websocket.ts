import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { Logger } from "../types/logger.js";
import { RELOAD_MESSAGE } from "../shared/constants.js";

/** Handle over the live-reload WebSocket channel. */
export interface ReloadSocket {
  /** Pushes a reload signal to every connected client. */
  broadcastReload(): void;
  /** Number of currently connected clients. */
  readonly clientCount: number;
  /** Closes the WebSocket server and all connections. */
  close(): Promise<void>;
}

export interface ReloadSocketOptions {
  /** The HTTP server to share the port with (handles the WS upgrade). */
  server: HttpServer;
  logger: Logger;
}

/**
 * Attaches a live-reload WebSocket server to an existing HTTP server so the
 * client (injected into the HTML) and the server share a single port.
 *
 * The protocol is intentionally one-way and trivial in v0.2.0: the server
 * pushes {@link RELOAD_MESSAGE} and the client does a full page reload. v1.x
 * will replace this with a richer, bidirectional HMR channel — only this
 * module changes.
 */
export function createReloadSocket(options: ReloadSocketOptions): ReloadSocket {
  const { server, logger } = options;
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
  });

  wss.on("error", (error) => {
    logger.error(`websocket error: ${error.message}`);
  });

  return {
    broadcastReload() {
      for (const socket of clients) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(RELOAD_MESSAGE);
        }
      }
    },
    get clientCount() {
      return clients.size;
    },
    close() {
      return new Promise((resolveClose) => {
        for (const socket of clients) socket.terminate();
        clients.clear();
        wss.close(() => resolveClose());
      });
    },
  };
}
