import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { runBuild } from "../src/build/index.js";
import { detectHtmlEntry } from "../src/html/index.js";
import { BuildError, HtmlEntryError } from "../src/shared/errors.js";
import {
  buildProject as build,
  cleanupProjects,
  listFiles,
  makeContext,
  makeProject,
  read,
} from "./utils/helpers.js";

afterEach(cleanupProjects);

const HTML =
  `<!doctype html><html><head></head><body>` +
  `<script type="module" src="/src/main.ts"></script></body></html>`;

describe("runBuild", () => {
  it("bundles, hashes, rewrites HTML, minifies, and copies public", async () => {
    const { dir, result, dist } = await build({
      "index.html": HTML,
      "src/main.ts": `export const x: number = 1;\nconsole.log(x);`,
      "public/robots.txt": "User-agent: *",
    });

    const entry = result.entries[0]!;
    expect(entry.src).toBe("/src/main.ts");
    expect(entry.fileName).toMatch(/^assets\/main-[\w-]+\.js$/);

    const html = await read(dir, "dist/index.html");
    expect(html).toContain(`src="/${entry.fileName}"`);
    expect(html).not.toContain("/src/main.ts");

    expect(dist).toContain("robots.txt");

    const js = await read(dir, `dist/${entry.fileName}`);
    expect(js).not.toContain(": number"); // transpiled
    expect(js).not.toContain("\n\n"); // minified
  });

  it("tree-shakes unused exports", async () => {
    const { dir, result } = await build({
      "index.html": HTML,
      "src/main.ts": `import { used } from "./lib.ts";\nconsole.log(used());`,
      "src/lib.ts": `export const used = () => "USED_42";\nexport const dead = () => "DEAD_99";`,
    });
    const js = await read(dir, `dist/${result.entries[0]!.fileName}`);
    expect(js).toContain("USED_42");
    expect(js).not.toContain("DEAD_99");
  });

  it("code-splits dynamic imports into separate chunks", async () => {
    const { dist } = await build({
      "index.html": HTML,
      "src/main.ts": `addEventListener("click", () => import("./lazy.ts"));`,
      "src/lazy.ts": `export const run = () => console.log("lazy");`,
    });
    expect(dist.filter((f) => f.endsWith(".js")).length).toBeGreaterThanOrEqual(2);
  });

  it("emits JS-imported assets with an absolute URL derived from base", async () => {
    const { dir, result, dist } = await build(
      {
        "index.html": HTML,
        "src/main.ts": `import logo from "./logo.svg";\ndocument.title = logo;`,
        "src/logo.svg": `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
      },
      { base: "/app/" },
    );
    expect(dist.some((f) => /^assets\/logo-[\w-]+\.svg$/.test(f))).toBe(true);
    const js = await read(dir, `dist/${result.entries[0]!.fileName}`);
    expect(js).toMatch(/\/app\/assets\/logo-[\w-]+\.svg/);
  });

  it("emits a valid source map when enabled", async () => {
    const { dir, dist } = await build(
      { "index.html": HTML, "src/main.ts": `console.log("hi");` },
      { build: { sourcemap: true } },
    );
    const mapFile = dist.find((f) => f.endsWith(".js.map"));
    expect(mapFile).toBeDefined();
    const map = JSON.parse(await read(dir, `dist/${mapFile}`));
    expect(map.version).toBe(3);
    expect(map.mappings.length).toBeGreaterThan(0);
  });

  it("never lets public/index.html overwrite the generated HTML", async () => {
    const { dir, logger } = await build({
      "index.html": HTML,
      "src/main.ts": `console.log(1);`,
      "public/index.html": "SHOULD_NOT_WIN",
    });
    const html = await read(dir, "dist/index.html");
    expect(html).not.toContain("SHOULD_NOT_WIN");
    expect(html).toContain("assets/");
    expect(logger.messages.some((m) => m.startsWith("warn"))).toBe(true);
  });

  it("supports multiple module entries", async () => {
    const html =
      `<!doctype html><body>` +
      `<script type="module" src="/src/a.ts"></script>` +
      `<script type="module" src="/src/b.ts"></script></body>`;
    const { dir, result } = await build({
      "index.html": html,
      "src/a.ts": `console.log("a");`,
      "src/b.ts": `console.log("b");`,
    });
    expect(result.entries.map((e) => e.src).sort()).toEqual(["/src/a.ts", "/src/b.ts"]);
    const out = await read(dir, "dist/index.html");
    for (const e of result.entries) expect(out).toContain(`/${e.fileName}`);
    expect(out).not.toContain("/src/a.ts");
  });

  it("cleans stale files from a previous build", async () => {
    const dir = await makeProject({
      "index.html": HTML,
      "src/main.ts": `console.log(1);`,
    });
    const { ctx } = makeContext(dir);
    const entry = await detectHtmlEntry(ctx.config.paths.root);
    await runBuild({ ctx, entry });

    // Plant a stale file, rebuild, expect it gone.
    await writeFile(join(dir, "dist/stale.txt"), "old");
    await runBuild({ ctx, entry });

    const dist = await listFiles(join(dir, "dist"));
    expect(dist).not.toContain("stale.txt");
  });

  describe("aliases & env", () => {
    it("resolves aliases in the bundle", async () => {
      const { dir, result } = await build(
        {
          "index.html": HTML,
          "src/main.ts": `import { x } from "@/lib";\nconsole.log(x);`,
          "src/lib.ts": `export const x = "ALIASED_42";`,
        },
        { resolve: { alias: { "@": "./src" } } },
      );
      expect(await read(dir, `dist/${result.entries[0]!.fileName}`)).toContain(
        "ALIASED_42",
      );
    });

    it("replaces import.meta.env (prefixed only) from the loaded env", async () => {
      const { dir, result } = await build(
        {
          "index.html": HTML,
          "src/main.ts":
            `console.log(import.meta.env.MODE, import.meta.env.VANTRIS_X, import.meta.env.SECRET);`,
        },
        {},
        { mode: "production", env: { VANTRIS_X: "EXPOSED", SECRET: "HIDDEN" } },
      );
      const js = await read(dir, `dist/${result.entries[0]!.fileName}`);
      expect(js).toContain("production");
      expect(js).toContain("EXPOSED");
      expect(js).not.toContain("HIDDEN");
    });
  });

  describe("errors", () => {
    it("throws HtmlEntryError when there is no index.html", async () => {
      await expect(build({ "src/main.ts": "1;" })).rejects.toBeInstanceOf(HtmlEntryError);
    });

    it("throws BuildError when the HTML has no module script", async () => {
      await expect(
        build({ "index.html": "<body></body>", "src/main.ts": "1;" }),
      ).rejects.toBeInstanceOf(BuildError);
    });

    it("throws BuildError when an entry module is missing", async () => {
      await expect(build({ "index.html": HTML })).rejects.toBeInstanceOf(BuildError);
    });

    it("refuses an outDir that overlaps the project root", async () => {
      await expect(
        build({ "index.html": HTML, "src/main.ts": "1;" }, { outDir: "." }),
      ).rejects.toBeInstanceOf(BuildError);
    });
  });
});
