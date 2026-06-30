import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readTsconfigAliases } from "../src/config/tsconfig.js";
import { createContext } from "../src/shared/context.js";
import { cleanupProjects, makeProject, silentLogger } from "./helpers.js";

afterEach(cleanupProjects);

describe("readTsconfigAliases", () => {
  it("converts paths + baseUrl into prefix aliases", async () => {
    const dir = await makeProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"], "~lib": ["./lib/index.ts"] } },
      }),
    });
    const aliases = await readTsconfigAliases(dir);
    expect(aliases).toEqual({
      "@": join(dir, "src"),
      "~lib": join(dir, "lib/index.ts"),
    });
  });

  it("parses JSONC (comments + trailing commas)", async () => {
    const dir = await makeProject({
      "tsconfig.json": `{
        // project config
        "compilerOptions": {
          "baseUrl": ".",
          "paths": { "@/*": ["./src/*"], }, /* trailing comma */
        },
      }`,
    });
    expect(await readTsconfigAliases(dir)).toEqual({ "@": join(dir, "src") });
  });

  it("defaults baseUrl to the tsconfig directory", async () => {
    const dir = await makeProject({
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    });
    expect(await readTsconfigAliases(dir)).toEqual({ "@": join(dir, "src") });
  });

  it("follows a relative extends", async () => {
    const dir = await makeProject({
      "tsconfig.base.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } },
      }),
      "tsconfig.json": JSON.stringify({ extends: "./tsconfig.base.json" }),
    });
    expect(await readTsconfigAliases(dir)).toEqual({ "@": join(dir, "src") });
  });

  it("skips the catch-all '*' mapping", async () => {
    const dir = await makeProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "*": ["./types/*"], "@/*": ["./src/*"] } },
      }),
    });
    expect(await readTsconfigAliases(dir)).toEqual({ "@": join(dir, "src") });
  });

  it("returns {} with no tsconfig or no paths", async () => {
    expect(await readTsconfigAliases(await makeProject({}))).toEqual({});
    const noPaths = await makeProject({
      "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
    });
    expect(await readTsconfigAliases(noPaths)).toEqual({});
  });
});

describe("createContext — tsconfig alias fallback", () => {
  it("adopts tsconfig aliases when none are configured", async () => {
    const dir = await makeProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } },
      }),
    });
    const ctx = await createContext({ cwd: dir, logger: silentLogger() });
    expect(ctx.config.resolve.alias.map((a) => a.find)).toContain("@");
  });

  it("lets explicit Vantris aliases win over tsconfig", async () => {
    const dir = await makeProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } },
      }),
      "vantris.config.mjs": `export default { resolve: { alias: { "~": "./lib" } } };`,
    });
    const ctx = await createContext({ cwd: dir, logger: silentLogger() });
    expect(ctx.config.resolve.alias.map((a) => a.find)).toEqual(["~"]);
  });
});
