import { afterEach, describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { contentTypeFor } from "../src/server/mime.js";
import { createStaticLoader } from "../src/server/static.js";
import { shouldTranspile, transpile } from "../src/server/transform.js";
import { cleanupProjects, makeContext, makeProject } from "./utils/helpers.js";

afterEach(cleanupProjects);

describe("transform", () => {
  it("flags TypeScript/JSX for transpilation only", () => {
    expect(shouldTranspile("a.ts")).toBe(true);
    expect(shouldTranspile("a.tsx")).toBe(true);
    expect(shouldTranspile("a.mts")).toBe(true);
    expect(shouldTranspile("a.js")).toBe(false);
    expect(shouldTranspile("a.css")).toBe(false);
  });

  it("transpiles TS to ESM, stripping types, with an inline source map", async () => {
    const out = await transpile(
      `export const x: number = 1;\nconsole.log(x);`,
      "main.ts",
    );
    expect(out).not.toContain(": number");
    expect(out).toContain("const x = 1");
    expect(out).toContain("export");
    expect(out).toContain("sourceMappingURL=data:application/json");
  });
});

describe("mime", () => {
  it("maps extensions to content types", () => {
    expect(contentTypeFor("a.html")).toContain("text/html");
    expect(contentTypeFor("a.css")).toContain("text/css");
    expect(contentTypeFor("a.js")).toContain("javascript");
    expect(contentTypeFor("a.svg")).toContain("image/svg");
    expect(contentTypeFor("a.bin")).toBe("application/octet-stream");
  });

  it("serves transpiled files as JavaScript regardless of source ext", () => {
    expect(contentTypeFor("a.ts", true)).toContain("javascript");
  });
});

describe("static loader (allowlist)", () => {
  async function loaderFor(files: Record<string, string>) {
    const dir = await makeProject(files);
    const { paths } = makeContext(dir).ctx.config;
    return createStaticLoader({
      root: paths.root,
      rootDir: paths.rootDir,
      publicDir: paths.publicDir,
    });
  }

  it("serves and transpiles source files from rootDir", async () => {
    const load = await loaderFor({ "src/main.ts": `const x: number = 1; export {};` });
    const asset = await load("/src/main.ts");
    expect(asset).not.toBeNull();
    expect(asset!.contentType).toContain("javascript");
    expect(String(asset!.body)).not.toContain(": number");
  });

  it("serves public files at the root", async () => {
    const load = await loaderFor({
      "src/main.ts": `export {};`,
      "public/robots.txt": "User-agent: *",
    });
    const asset = await load("/robots.txt");
    expect(String(asset!.body)).toBe("User-agent: *");
  });

  it("resolves extensionless source imports", async () => {
    const load = await loaderFor({ "src/util.ts": `export const u = 1;` });
    expect(await load("/src/util")).not.toBeNull();
  });

  it("flags HTML assets", async () => {
    const load = await loaderFor({ "public/page.html": "<h1>hi</h1>" });
    expect((await load("/page.html"))!.isHtml).toBe(true);
  });

  it("refuses files outside rootDir/publicDir and path traversal", async () => {
    const load = await loaderFor({
      "src/main.ts": `export {};`,
      "package.json": `{"name":"secret"}`,
    });
    expect(await load("/package.json")).toBeNull();
    expect(await load("/../package.json")).toBeNull();
    expect(await load("/src/missing.ts")).toBeNull();
  });
});
