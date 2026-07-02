import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Logger } from "../types/logger.js";
import { RELOAD_MESSAGE } from "../shared/constants.js";

/**
 * A dependency-free WebSocket server (RFC 6455) scoped to Vantris's needs: the
 * dev server pushes short text messages (`{ type: "reload" }`) and answers
 * pings. It is deliberately **not** a general-purpose WebSocket server — no
 * `permessage-deflate`, no sub-protocols, no fragmentation reassembly beyond
 * what live-reload requires — which keeps it to a few dozen readable lines and
 * removes the `ws` dependency.
 */

/** The magic GUID from RFC 6455 §1.3, appended to the client key. */
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const OP_TEXT = 0x1;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

/** Computes the `Sec-WebSocket-Accept` value for a client key. */
export function computeAccept(key: string): string {
  return createHash("sha1").update(key + WS_GUID).digest("base64");
}

/** Encodes an unmasked server→client frame (server frames are never masked). */
function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length;
  let header: Buffer;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length < 0x10000) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

/** Encodes a text frame carrying `message`. */
export function encodeTextFrame(message: string): Buffer {
  return encodeFrame(OP_TEXT, Buffer.from(message, "utf8"));
}

interface Frame {
  opcode: number;
  payload: Buffer;
}

/**
 * Parses as many complete frames as `buffer` holds, unmasking client payloads.
 * Returns the parsed frames and any trailing bytes of an incomplete frame.
 */
export function parseFrames(buffer: Buffer): { frames: Frame[]; rest: Buffer } {
  const frames: Frame[] = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset]!;
    const second = buffer[offset + 1]!;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let cursor = offset + 2;

    if (length === 126) {
      if (cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }

    let mask: Buffer | null = null;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      mask = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }

    if (cursor + length > buffer.length) break; // frame not fully received yet

    let payload = buffer.subarray(cursor, cursor + length);
    if (mask) {
      const unmasked = Buffer.allocUnsafe(length);
      for (let i = 0; i < length; i++) unmasked[i] = payload[i]! ^ mask[i & 3]!;
      payload = unmasked;
    }

    frames.push({ opcode, payload });
    offset = cursor + length;
  }

  return { frames, rest: buffer.subarray(offset) };
}

/** The live-reload hub: tracks connections and broadcasts reload messages. */
export interface ReloadHub {
  /** Completes the handshake on an upgraded socket and starts tracking it. */
  handleUpgrade(request: IncomingMessage, socket: Duplex): void;
  /** Pushes a reload message to every connected client. */
  broadcastReload(): void;
  /** Number of connected clients. */
  readonly clientCount: number;
  /** Closes every connection. */
  close(): Promise<void>;
}

/** Creates a {@link ReloadHub} backed by the hand-rolled WebSocket protocol. */
export function createReloadHub(logger: Logger): ReloadHub {
  const clients = new Set<Duplex>();
  const buffers = new WeakMap<Duplex, Buffer>();

  const drop = (socket: Duplex): void => {
    clients.delete(socket);
    buffers.delete(socket);
  };

  return {
    handleUpgrade(request, socket) {
      const key = request.headers["sec-websocket-key"];
      if (typeof key !== "string") {
        socket.destroy();
        return;
      }

      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${computeAccept(key)}\r\n\r\n`,
      );

      clients.add(socket);
      buffers.set(socket, Buffer.alloc(0));

      socket.on("data", (chunk: Buffer) => {
        const buffer = Buffer.concat([buffers.get(socket) ?? Buffer.alloc(0), chunk]);
        const { frames, rest } = parseFrames(buffer);
        buffers.set(socket, rest);

        for (const { opcode, payload } of frames) {
          if (opcode === OP_CLOSE) {
            socket.write(encodeFrame(OP_CLOSE, Buffer.alloc(0)));
            socket.end();
            drop(socket);
            return;
          }
          if (opcode === OP_PING) {
            socket.write(encodeFrame(OP_PONG, payload)); // echo the ping payload
          }
          // Text/pong frames from the client are ignored — the channel is
          // server→client only for live reload.
        }
      });

      socket.on("close", () => drop(socket));
      socket.on("error", (error: Error) => {
        logger.debug(`websocket connection error: ${error.message}`);
        drop(socket);
        socket.destroy();
      });
    },

    broadcastReload() {
      const frame = encodeTextFrame(RELOAD_MESSAGE);
      for (const socket of clients) {
        if (socket.writable) socket.write(frame);
      }
    },

    get clientCount() {
      return clients.size;
    },

    close() {
      return new Promise((resolve) => {
        for (const socket of clients) {
          try {
            socket.write(encodeFrame(OP_CLOSE, Buffer.alloc(0)));
            socket.destroy();
          } catch {
            // already gone
          }
        }
        clients.clear();
        resolve();
      });
    },
  };
}
