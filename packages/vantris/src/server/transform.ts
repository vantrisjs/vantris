import { extname } from "node:path";
import { transform, type Loader } from "esbuild";

/** Extensions handled by the on-the-fly TypeScript/JSX transpiler. */
const TRANSPILE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".jsx"]);

/** Whether a file path should be transpiled before being served. */
export function shouldTranspile(file: string): boolean {
  return TRANSPILE_EXTENSIONS.has(extname(file).toLowerCase());
}

/** Maps a file extension to the matching esbuild loader. */
function loaderFor(file: string): Loader {
  switch (extname(file).toLowerCase()) {
    case ".tsx":
      return "tsx";
    case ".jsx":
      return "jsx";
    default:
      return "ts";
  }
}

/**
 * Transpiles a single TypeScript/JSX module to browser-ready ESM using esbuild.
 *
 * This is a **transform only** — no bundling, no production optimisation. The
 * optional `define` map statically replaces tokens like `import.meta.env.X`.
 * An inline source map is emitted so the browser maps back to the original.
 */
export async function transpile(
  code: string,
  file: string,
  define?: Record<string, string>,
): Promise<string> {
  const result = await transform(code, {
    loader: loaderFor(file),
    format: "esm",
    target: "es2022",
    sourcemap: "inline",
    sourcefile: file,
    ...(define ? { define } : {}),
  });
  return result.code;
}
