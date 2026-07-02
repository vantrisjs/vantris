import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join } from "node:path";
import type { Context } from "../types/context.js";
import { HTML_ENTRY_FILENAME } from "../shared/constants.js";
import { PreviewError } from "../shared/errors.js";
import { isDirectory, isFile } from "../utils/fs.js";
import { getNetworkHost } from "../utils/network.js";
import { openBrowser } from "../utils/open.js";
import { closeServer, listen, localUrl } from "../server/http.js";
import { createOutputLoader } from "./static.js";

/** Options for {@link startPreviewServer}. */
export interface PreviewServerOptions {
  ctx: Context;
  /**
   * Browser opener, injected for testing. Defaults to the real platform opener
   * ({@link openBrowser}). Only called when `preview.open` is `true`.
   */
  open?: (url: string) => void;
}

/** A running preview server. */
export interface PreviewServerHandle {
  /** Local URL, e.g. `http://localhost:4173/`. */
  readonly url: string;
  /** LAN URL for other devices, or `null` when unavailable. */
  readonly networkUrl: string | null;
  readonly host: string;
  readonly port: number;
  /** Absolute directory being served (`outDir`). */
  readonly root: string;
  /** Time taken to start, in milliseconds. */
  readonly startupMs: number;
  /** Stops the server. */
  close(): Promise<void>;
}

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8" } as const;

/**
 * Starts the preview server on native `node:http`, serving a finished build
 * from `outDir` exactly as produced — no compilation. Static files are served
 * with the right content types, and unmatched navigations fall back to
 * `index.html` (SPA).
 *
 * @throws {PreviewError} when `outDir` does not exist (no build yet).
 * @throws {ServerError} when the port is already in use.
 */
export async function startPreviewServer(
  options: PreviewServerOptions,
): Promise<PreviewServerHandle> {
  const { ctx } = options;
  const { paths, preview, base } = ctx.config;
  const started = Date.now();

  if (!(await isDirectory(paths.outDir))) {
    throw new PreviewError(
      `Output directory not found: ${paths.outDir}. ` +
        "Run `vantris build` before `vantris preview`.",
    );
  }

  const loadFile = createOutputLoader(paths.outDir);
  const indexFile = join(paths.outDir, HTML_ENTRY_FILENAME);

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");

    // Map the public URL (which includes `base`) back to a path under outDir.
    const filePath = stripBase(url.pathname, base);
    if (filePath !== null) {
      const file = await loadFile(filePath);
      if (file) {
        res.writeHead(200, { "content-type": file.contentType });
        res.end(file.body);
        return;
      }
    }

    // SPA fallback: navigations resolve to index.html.
    if (isNavigation(req, url.pathname) && (await isFile(indexFile))) {
      res.writeHead(200, HTML_HEADERS);
      res.end(await readFile(indexFile));
      return;
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(`404 Not Found: ${url.pathname}`);
  };

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("500 Internal Server Error");
    });
  });
  const port = await listen(server, preview.port, preview.host);

  // Only a wildcard host is reachable over the network; `0.0.0.0`/`::` aren't
  // browsable directly, so present `localhost` locally and the LAN IP for the
  // network. A specific/loopback host is shown as-is with no network URL.
  const wildcard = preview.host === "0.0.0.0" || preview.host === "::";
  const url = localUrl(wildcard ? "localhost" : preview.host, port);
  const networkHost = wildcard ? getNetworkHost() : null;
  const networkUrl = networkHost ? localUrl(networkHost, port) : null;
  const startupMs = Date.now() - started;

  if (preview.open) (options.open ?? openBrowser)(url);

  return {
    url,
    networkUrl,
    host: preview.host,
    port,
    root: paths.outDir,
    startupMs,
    close: () => closeServer(server),
  };
}

/**
 * Maps a public pathname (which includes `base`) to a path relative to the
 * output root, or `null` when the request is outside `base`.
 */
function stripBase(pathname: string, base: string): string | null {
  if (base === "/") return pathname;
  if (pathname === base || `${pathname}/` === base) return "/";
  if (pathname.startsWith(base)) return pathname.slice(base.length - 1);
  return null;
}

/** Whether a request should fall back to `index.html` (a page navigation). */
function isNavigation(req: IncomingMessage, pathname: string): boolean {
  if (extname(pathname) === "") return true;
  return (req.headers.accept ?? "").includes("text/html");
}
