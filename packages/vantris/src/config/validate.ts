import { ConfigError } from "../shared/errors.js";

/** Human-readable description of a received value for error messages. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "function") return "a function";
  if (typeof value === "object") return "an object";
  return `${typeof value} ${JSON.stringify(value)}`;
}

/** Throws a {@link ConfigError} naming the property, expectation, and value. */
function fail(path: string, received: unknown, expected: string): never {
  throw new ConfigError(
    `Invalid config at "${path}": expected ${expected}, received ${describe(received)}.`,
  );
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function string(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "string") fail(path, value, "a string");
}
function number(value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
    fail(path, value, "a number");
  }
}
function boolean(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "boolean") fail(path, value, "a boolean");
}
function stringOrFn(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "string" && typeof value !== "function") {
    fail(path, value, "a string or a function");
  }
}
function object(value: unknown, path: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) fail(path, value, "an object");
  return value;
}

/**
 * Validates a raw user configuration. Unknown properties are ignored (so future
 * options never break older versions); known properties are type-checked, and
 * the first problem throws a {@link ConfigError} with the property path, the
 * expected type, and the received value.
 */
export function validateConfig(input: unknown): void {
  const config = object(input, "(config)");
  if (!config) return;

  for (const key of ["root", "rootDir", "publicDir", "outDir", "base"]) {
    string(config[key], key);
  }

  const dev = object(config.dev, "dev");
  if (dev) {
    number(dev.port, "dev.port");
    string(dev.host, "dev.host");
  }

  const build = object(config.build, "build");
  if (build) {
    boolean(build.minify, "build.minify");
    const sm = build.sourcemap;
    if (sm !== undefined && typeof sm !== "boolean" && sm !== "inline" && sm !== "hidden") {
      fail("build.sourcemap", sm, 'a boolean, "inline", or "hidden"');
    }
    string(build.assetsDir, "build.assetsDir");
    stringOrFn(build.entryFileNames, "build.entryFileNames");
    stringOrFn(build.chunkFileNames, "build.chunkFileNames");
    stringOrFn(build.assetFileNames, "build.assetFileNames");
    boolean(build.emptyOutDir, "build.emptyOutDir");
    validateLib(build.lib);
  }

  const define = object(config.define, "define");
  if (define) {
    for (const [key, value] of Object.entries(define)) {
      const type = typeof value;
      if (type !== "string" && type !== "number" && type !== "boolean") {
        fail(`define.${key}`, value, "a string, number, or boolean");
      }
    }
  }

  const preview = object(config.preview, "preview");
  if (preview) {
    number(preview.port, "preview.port");
    string(preview.host, "preview.host");
    boolean(preview.open, "preview.open");
  }

  const resolve = object(config.resolve, "resolve");
  if (resolve) {
    const alias = object(resolve.alias, "resolve.alias");
    if (alias) {
      for (const [key, value] of Object.entries(alias)) {
        string(value, `resolve.alias.${key}`);
      }
    }
  }
}

const LIB_FORMATS = new Set(["esm", "cjs", "iife"]);

/** Validates `build.lib`, when present. */
function validateLib(value: unknown): void {
  const lib = object(value, "build.lib");
  if (!lib) return;

  if (typeof lib.entry !== "string") {
    fail("build.lib.entry", lib.entry, "a string");
  }
  string(lib.name, "build.lib.name");
  if (lib.formats !== undefined) {
    if (!Array.isArray(lib.formats)) {
      fail("build.lib.formats", lib.formats, "an array");
    }
    lib.formats.forEach((format, index) => {
      if (typeof format !== "string" || !LIB_FORMATS.has(format)) {
        fail(`build.lib.formats[${index}]`, format, '"esm", "cjs", or "iife"');
      }
    });
  }
  stringOrFn(lib.fileName, "build.lib.fileName");
}
