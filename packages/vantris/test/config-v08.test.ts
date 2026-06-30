import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config/resolve.js";
import { validateConfig } from "../src/config/validate.js";
import { ConfigError } from "../src/shared/errors.js";

const CWD = "/project";

describe("resolveConfig — v0.8 options", () => {
  it("serialises define values to JSON literals", () => {
    const { define } = resolveConfig(
      { define: { __DEV__: false, __APP_VERSION__: "1.2.3", __COUNT__: 7 } },
      CWD,
    );
    expect(define).toEqual({
      __DEV__: "false",
      __APP_VERSION__: '"1.2.3"',
      __COUNT__: "7",
    });
  });

  it("defaults emptyOutDir to true and honours an override", () => {
    expect(resolveConfig({}, CWD).build.emptyOutDir).toBe(true);
    expect(resolveConfig({ build: { emptyOutDir: false } }, CWD).build.emptyOutDir).toBe(false);
  });

  it("derives the cache dir under node_modules", () => {
    expect(resolveConfig({}, CWD).cacheDir).toBe(join(CWD, "node_modules/.vantris"));
  });

  it("resolves library options with defaults", () => {
    const { build } = resolveConfig({ build: { lib: { entry: "./src/index.ts" } } }, CWD);
    expect(build.lib).toEqual({
      entry: join(CWD, "src/index.ts"),
      name: null,
      formats: ["esm", "cjs"],
      fileName: "index",
    });
  });

  it("keeps explicit library name, formats, and fileName", () => {
    const { build } = resolveConfig(
      { build: { lib: { entry: "./src/lib.ts", name: "Foo", formats: ["iife"], fileName: "foo" } } },
      CWD,
    );
    expect(build.lib).toMatchObject({ name: "Foo", formats: ["iife"], fileName: "foo" });
  });

  it("is null for a non-library build", () => {
    expect(resolveConfig({}, CWD).build.lib).toBeNull();
  });
});

describe("validateConfig — v0.8 options", () => {
  const bad = (config: unknown, re: RegExp) =>
    expect(() => validateConfig(config)).toThrow(re);

  it("accepts valid v0.8 config", () => {
    expect(() =>
      validateConfig({
        define: { __DEV__: true, V: "1", N: 2 },
        build: {
          emptyOutDir: false,
          lib: { entry: "./src/index.ts", name: "X", formats: ["esm", "cjs", "iife"] },
        },
      }),
    ).not.toThrow();
  });

  it("rejects a non-string lib.entry", () => {
    bad({ build: { lib: { entry: 123 } } }, /build\.lib\.entry/);
  });

  it("rejects an unknown lib format", () => {
    bad({ build: { lib: { entry: "./x.ts", formats: ["umd"] } } }, /build\.lib\.formats\[0\]/);
  });

  it("rejects a non-array lib.formats", () => {
    bad({ build: { lib: { entry: "./x.ts", formats: "esm" } } }, /build\.lib\.formats/);
  });

  it("rejects a non-boolean emptyOutDir", () => {
    bad({ build: { emptyOutDir: "yes" } }, /build\.emptyOutDir/);
  });

  it("rejects an object define value", () => {
    bad({ define: { X: { nested: true } } }, /define\.X/);
  });

  it("throws a ConfigError", () => {
    expect(() => validateConfig({ build: { lib: { entry: 1 } } })).toThrow(ConfigError);
  });
});
