import { afterEach, describe, expect, it } from "vitest";
import { buildProject, cleanupProjects, read } from "./helpers.js";

afterEach(cleanupProjects);

const HTML =
  `<!doctype html><html><head></head><body>` +
  `<script type="module" src="/src/main.ts"></script></body></html>`;

const cssFile = (dist: string[]) => dist.find((f) => f.endsWith(".css"))!;

describe("library mode", () => {
  it("emits each requested format in one build", async () => {
    const { dir, dist } = await buildProject(
      { "src/index.ts": `export const greet = (n: string) => "hi " + n;` },
      {
        build: {
          minify: false,
          lib: { entry: "./src/index.ts", name: "Lib", formats: ["esm", "cjs", "iife"] },
        },
      },
    );
    expect(dist).toEqual(expect.arrayContaining(["index.mjs", "index.cjs", "index.iife.js"]));
    expect(await read(dir, "dist/index.mjs")).toContain("export");
    expect(await read(dir, "dist/index.cjs")).toContain("exports");
    expect(await read(dir, "dist/index.iife.js")).toContain("Lib");
  });

  it("defaults to esm + cjs", async () => {
    const { dist } = await buildProject(
      { "src/index.ts": `export const x = 1;` },
      { build: { lib: { entry: "./src/index.ts" } } },
    );
    expect(dist).toEqual(expect.arrayContaining(["index.mjs", "index.cjs"]));
    expect(dist.some((f) => f.endsWith(".iife.js"))).toBe(false);
  });
});

describe("define", () => {
  it("replaces global constants at build time", async () => {
    const { dir, result } = await buildProject(
      { "index.html": HTML, "src/main.ts": `if (__DEV__) console.log("d");\nconsole.log(__VER__);` },
      { define: { __DEV__: false, __VER__: "9.9" }, build: { minify: false } },
    );
    const js = await read(dir, `dist/${result.entries[0]!.fileName}`);
    expect(js).not.toContain("__DEV__");
    expect(js).not.toContain("__VER__");
    expect(js).toContain('"9.9"');
  });
});

describe("source maps", () => {
  const FILES = {
    "index.html": HTML,
    "src/main.ts": `import "./s.css";\nexport const x = 1;\nconsole.log(x);`,
    "src/s.css": `.a { color: red; }`,
  };

  it("true: external .map files with sourceMappingURL comments", async () => {
    const { dir, dist, result } = await buildProject(FILES, { build: { sourcemap: true, minify: false } });
    expect(dist.some((f) => f.endsWith(".js.map"))).toBe(true);
    expect(dist.some((f) => f.endsWith(".css.map"))).toBe(true);
    expect(await read(dir, `dist/${result.entries[0]!.fileName}`)).toContain("sourceMappingURL=");
    expect(await read(dir, `dist/${cssFile(dist)}`)).toContain("sourceMappingURL=");
  });

  it("inline: embeds a data URL and writes no .map files", async () => {
    const { dir, dist } = await buildProject(FILES, { build: { sourcemap: "inline", minify: false } });
    expect(dist.some((f) => f.endsWith(".map"))).toBe(false);
    expect(await read(dir, `dist/${cssFile(dist)}`)).toContain(
      "sourceMappingURL=data:application/json;base64,",
    );
  });

  it("hidden: writes .map files without a comment", async () => {
    const { dir, dist } = await buildProject(FILES, { build: { sourcemap: "hidden", minify: false } });
    expect(dist.some((f) => f.endsWith(".css.map"))).toBe(true);
    expect(await read(dir, `dist/${cssFile(dist)}`)).not.toContain("sourceMappingURL=");
  });

  it("false: emits no maps (default)", async () => {
    const { dist } = await buildProject(FILES, { build: { minify: false } });
    expect(dist.some((f) => f.endsWith(".map"))).toBe(false);
  });
});

describe("emptyOutDir", () => {
  const FILES = { "index.html": HTML, "src/main.ts": `console.log(1);`, "dist/stale.txt": "old" };

  it("wipes the output directory by default", async () => {
    const { dist } = await buildProject(FILES, {});
    expect(dist).not.toContain("stale.txt");
  });

  it("keeps existing files when false", async () => {
    const { dist } = await buildProject(FILES, { build: { emptyOutDir: false } });
    expect(dist).toContain("stale.txt");
  });
});

describe("assets", () => {
  it("emits wasm/txt as hashed URLs and inlines json", async () => {
    const { dir, result } = await buildProject(
      {
        "index.html": HTML,
        "src/main.ts":
          `import w from "./m.wasm";\nimport t from "./n.txt";\nimport d from "./d.json";\nconsole.log(w, t, d.v);`,
        "src/m.wasm": "\x00asm",
        "src/n.txt": "hello",
        "src/d.json": `{"v":5}`,
      },
      { build: { minify: false } },
    );
    const js = await read(dir, `dist/${result.entries[0]!.fileName}`);
    expect(js).toMatch(/m-[\w-]+\.wasm/);
    expect(js).toMatch(/n-[\w-]+\.txt/);
    expect(js).toContain("5"); // json inlined as data, not a URL
  });
});

describe("base (regression)", () => {
  it("applies base everywhere; dynamic imports stay relative", async () => {
    const { dir, dist, result } = await buildProject(
      {
        "index.html": HTML,
        "src/main.ts":
          `import "./s.css";\nimport logo from "./l.svg";\nconsole.log(logo);\n` +
          `addEventListener("click", () => import("./lazy.ts"));`,
        "src/lazy.ts": `export const z = 1;`,
        "src/s.css": `.a { background: url("./bg.png"); }`,
        "src/bg.png": "PNG",
        "src/l.svg": "<svg/>",
      },
      { base: "/app/", build: { minify: false } },
    );

    expect(await read(dir, "dist/index.html")).toContain('src="/app/assets/');
    const js = await read(dir, `dist/${result.entries[0]!.fileName}`);
    expect(js).toContain('"/app/assets/l-'); // asset import → base-prefixed
    expect(js).toMatch(/import\("\.\//); // dynamic import → relative (base-agnostic)
    expect(await read(dir, `dist/${cssFile(dist)}`)).toContain("/app/assets/bg-");
  });
});
