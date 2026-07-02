import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { createResolver } from "../src/resolver/index.js";
import { cleanupProjects, makeProject } from "./utils/helpers.js";

afterEach(cleanupProjects);

describe("createResolver — alias", () => {
  const resolver = createResolver({
    // Pre-sorted longest-first, as resolveConfig produces.
    alias: [
      { find: "@foo", replacement: "/abs/foo" },
      { find: "@", replacement: "/abs/src" },
    ],
    extensions: [".ts", ".js"],
  });

  it("substitutes exact and prefixed specifiers", () => {
    expect(resolver.alias("@")).toBe("/abs/src");
    expect(resolver.alias("@/x")).toBe("/abs/src/x");
    expect(resolver.alias("@/a/b.ts")).toBe("/abs/src/a/b.ts");
  });

  it("prefers the longest matching alias", () => {
    expect(resolver.alias("@foo/y")).toBe("/abs/foo/y");
  });

  it("returns null for non-aliased specifiers", () => {
    expect(resolver.alias("./relative")).toBeNull();
    expect(resolver.alias("react")).toBeNull();
  });
});

describe("createResolver — resolveFile", () => {
  it("resolves an alias plus extension to a real file", async () => {
    const dir = await makeProject({ "src/util.ts": "export const u = 1;" });
    const resolver = createResolver({
      alias: [{ find: "@", replacement: join(dir, "src") }],
      extensions: [".ts", ".js"],
    });
    expect(await resolver.resolveFile("@/util")).toBe(join(dir, "src/util.ts"));
  });

  it("resolves relative specifiers against the importer", async () => {
    const dir = await makeProject({ "src/a.ts": "1;", "src/b.ts": "1;" });
    const resolver = createResolver({ alias: [], extensions: [".ts"] });
    const importer = join(dir, "src/a.ts");
    expect(await resolver.resolveFile("./b", importer)).toBe(join(dir, "src/b.ts"));
  });

  it("returns null for bare and missing specifiers", async () => {
    const dir = await makeProject({ "src/a.ts": "1;" });
    const resolver = createResolver({
      alias: [{ find: "@", replacement: join(dir, "src") }],
      extensions: [".ts"],
    });
    expect(await resolver.resolveFile("react")).toBeNull();
    expect(await resolver.resolveFile("@/missing")).toBeNull();
  });
});
