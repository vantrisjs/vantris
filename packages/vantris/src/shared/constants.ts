/** Product name, used in CLI banners and logs. */
export const APP_NAME = "vantris";

/** Current Vantris version. Kept in sync with package.json at release time. */
export const VERSION = "0.4.0";

/** The HTML entry filename Vantris looks for at the project root. */
export const HTML_ENTRY_FILENAME = "index.html";

/** Default directory values, relative to the project root. */
export const DEFAULTS = {
  root: ".",
  rootDir: "./src",
  publicDir: "./public",
  outDir: "./dist",
} as const;

/** Default dev-server options. */
export const DEV_DEFAULTS = {
  port: 3000,
  host: "localhost",
} as const;

/** Default production-build options. */
export const BUILD_DEFAULTS = {
  minify: true,
  sourcemap: false,
  assetsDir: "assets",
} as const;

/** Default preview-server options. */
export const PREVIEW_DEFAULTS = {
  port: 4173,
  host: "localhost",
  open: false,
} as const;

/**
 * File extensions the build treats as bundler assets — imported in JS they are
 * emitted as hashed files and the import resolves to their URL. Extend this
 * list to support more resource types (images, fonts, media, …).
 */
export const ASSET_EXTENSIONS = [
  // images
  ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
  // fonts
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  // media
  ".mp4", ".webm", ".ogg", ".mp3", ".wav", ".flac", ".aac",
] as const;

/**
 * Message the dev server pushes over the WebSocket to ask the client to
 * reload. A typed string (rather than an empty frame) keeps room for richer
 * HMR messages in v1.x without breaking the v0.2 client.
 */
export const RELOAD_MESSAGE = "reload";

/** Config filenames Vantris will look for, in priority order. */
export const CONFIG_FILENAMES = [
  "vantris.config.ts",
  "vantris.config.js",
  "vantris.config.mjs",
] as const;
