import { extname } from "node:path";

/**
 * Extension → MIME type map for the dev server. Transpiled `.ts`/`.tsx` files
 * are served as JavaScript (see {@link contentTypeFor}). It mirrors the asset
 * types the build understands, so dev and build behave consistently.
 */
const MIME_TYPES: Record<string, string> = {
  // documents & code
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  // images
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  // fonts
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  // media
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
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
