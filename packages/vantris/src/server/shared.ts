import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { Logger } from "../types/logger.js";
import type {
  ResolvedCors,
  ResolvedProxyRule,
} from "../types/config-resolved.js";
import type { LoadedAsset } from "./static.js";

/**
 * Everything a runtime server (Node or Bun) needs to serve the app, independent
 * of the transport. `createDevServer` builds this once and hands it to whichever
 * runtime implementation is active, so the observable behaviour is identical.
 */
export interface RuntimeServerOptions {
  host: string;
  port: number;
  /** Dev base path, normalised to start and end with `/`. */
  base: string;
  /** `false`, or resolved TLS material to serve over HTTPS. */
  https: false | { cert: string; key: string };
  /** CORS policy, or `null` when disabled. */
  cors: ResolvedCors | null;
  /** Proxy rules (longest-context-first). */
  proxy: readonly ResolvedProxyRule[];
  /** Whether unmatched, route-like requests fall back to `index.html`. */
  spaFallback: boolean;
  logger: Logger;
  /** Resolves a request pathname to a served asset, or `null`. */
  loadAsset: (pathname: string) => Promise<LoadedAsset | null>;
  /** Absolute path of the HTML entry, or `null` when none exists. */
  entryFile: string | null;
  /** Injects the dev live-reload client into an HTML document. */
  transformHtml: (html: string) => string;
}

/** The public handle returned by every runtime server. */
export interface DevServerHandle {
  /** Address the app is served from, e.g. `http://localhost:3000/`. */
  readonly url: string;
  readonly host: string;
  readonly port: number;
  /** Whether the server is serving over HTTPS. */
  readonly https: boolean;
  /** Time taken to start, in milliseconds. */
  readonly startupMs: number;
  /** Pushes a full-page reload to every connected browser. */
  broadcastReload(): void;
  /** Stops the HTTP and WebSocket servers. */
  close(): Promise<void>;
}

/** A resolved response, independent of the runtime's response type. */
export interface Served {
  status: number;
  headers: Record<string, string>;
  body: string | Uint8Array;
}

export const HTML_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-cache",
};

/**
 * Hop-by-hop headers that must not be copied from a proxied upstream response:
 * the body is already decoded when forwarded, so `content-encoding`/`length`
 * would be wrong.
 */
export const HOP_BY_HOP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

/** Strips the dev base prefix from a request pathname. */
export function stripBase(pathname: string, base: string): string {
  if (base === "/") return pathname;
  if (pathname === base) return "/";
  if (pathname.startsWith(base)) return `/${pathname.slice(base.length)}`;
  return pathname;
}

/**
 * Serves a static asset or the SPA fallback for a (base-stripped) pathname.
 * Returns `null` when nothing matches, so the caller responds with 404.
 */
export async function serveApp(
  pathname: string,
  options: RuntimeServerOptions,
): Promise<Served | null> {
  const asset = await options.loadAsset(pathname);
  if (asset) {
    if (asset.isHtml) {
      return { status: 200, headers: HTML_HEADERS, body: options.transformHtml(asset.body as string) };
    }
    return {
      status: 200,
      headers: { "content-type": asset.contentType, "cache-control": "no-cache" },
      body: asset.body,
    };
  }

  if (options.entryFile && shouldFallback(pathname, options.spaFallback)) {
    const html = await readFile(options.entryFile, "utf8");
    return { status: 200, headers: HTML_HEADERS, body: options.transformHtml(html) };
  }

  return null;
}

/**
 * The root always serves the entry HTML. Other paths fall back to it only when
 * SPA fallback is enabled **and** the request is route-like (no file
 * extension) — a missing `.js`/`.png` stays a genuine 404.
 */
function shouldFallback(pathname: string, spaFallback: boolean): boolean {
  if (pathname === "/" || pathname === "") return true;
  return spaFallback && extname(pathname) === "";
}
