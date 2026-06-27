import { extname } from "node:path";

/**
 * Minimal extension → MIME type map for the dev server. Transpiled `.ts`/`.tsx`
 * files are served as JavaScript (see {@link contentTypeFor}). This stays small
 * on purpose; a full asset pipeline is out of scope for v0.2.0.
 */
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const JAVASCRIPT = "text/javascript; charset=utf-8";

/**
 * Resolves the `Content-Type` for a file path.
 *
 * @param file        Absolute or relative file path.
 * @param transpiled  When `true`, the file is served as JavaScript regardless
 *                    of its source extension (e.g. a transpiled `.ts`).
 */
export function contentTypeFor(file: string, transpiled = false): string {
  if (transpiled) return JAVASCRIPT;
  return MIME_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}
