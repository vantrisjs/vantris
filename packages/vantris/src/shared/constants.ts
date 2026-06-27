/** Product name, used in CLI banners and logs. */
export const APP_NAME = "vantris";

/** Current Vantris version. Kept in sync with package.json at release time. */
export const VERSION = "0.1.0";

/** The HTML entry filename Vantris looks for at the project root. */
export const HTML_ENTRY_FILENAME = "index.html";

/** Default directory values, relative to the project root. */
export const DEFAULTS = {
  root: ".",
  rootDir: "./src",
  publicDir: "./public",
  outDir: "./dist",
} as const;

/** Config filenames Vantris will look for, in priority order. */
export const CONFIG_FILENAMES = [
  "vantris.config.ts",
  "vantris.config.js",
  "vantris.config.mjs",
] as const;
