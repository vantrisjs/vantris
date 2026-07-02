import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { validateConfig } from "../src/config/validate.js";
import { ConfigError } from "../src/shared/errors.js";

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    expect(() =>
      validateConfig({
        rootDir: "./src",
        base: "/",
        dev: { port: 3000, host: "localhost" },
        build: { minify: true, sourcemap: "inline", entryFileNames: () => "x.js" },
        preview: { port: 4173, open: false },
        resolve: { alias: { "@": "./src" } },
      }),
    ).not.toThrow();
  });

  it("accepts an empty config and ignores unknown keys", () => {
    expect(() => validateConfig({})).not.toThrow();
    expect(() => validateConfig({ future: { whatever: true } })).not.toThrow();
  });

  it("reports the property path, expected type, and received value", () => {
    expect(() => validateConfig({ dev: { port: "3000" } })).toThrow(ConfigError);
    try {
      validateConfig({ dev: { port: "3000" } });
      expect.unreachable();
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("dev.port");
      expect(message).toContain("a number");
      expect(message).toContain('"3000"');
    }
  });

  it("rejects an invalid sourcemap value", () => {
    expect(() => validateConfig({ build: { sourcemap: "yes" } })).toThrow(
      /build\.sourcemap/,
    );
  });

  it("rejects a non-object section", () => {
    expect(() => validateConfig({ dev: 5 })).toThrow(/"dev".*object/s);
  });

  it("rejects a non-string alias replacement", () => {
    expect(() => validateConfig({ resolve: { alias: { "@": 5 } } })).toThrow(
      /resolve\.alias\.@/,
    );
  });

  it("rejects a non-string path option", () => {
    expect(() => validateConfig({ outDir: 123 })).toThrow(/"outDir".*string/s);
  });
});
