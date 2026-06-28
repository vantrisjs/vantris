import { afterEach, describe, expect, it } from "vitest";
import { buildProject as build, cleanupProjects, read } from "./helpers.js";

afterEach(cleanupProjects);

const page = () =>
  `<!doctype html><html><head></head><body>` +
  `<script type="module" src="/src/main.ts"></script></body></html>`;

const cssOf = (dist: string[]) => dist.find((f) => f.endsWith(".css"))!;
const entryJs = (dist: string[]) =>
  dist.find((f) => /main-[\w-]+\.js$/.test(f))!;

describe("CSS pipeline", () => {
  it("rewrites url() to a hashed asset, prefixed with base", async () => {
    const { dir, dist } = await build(
      {
        "index.html": page(),
        "src/main.ts": `import "./s.css";`,
        "src/s.css": `.a { background: url(./bg.png); }`,
        "src/bg.png": `PNGBYTES`,
      },
      { base: "/app/" },
    );
    const css = await read(dir, `dist/${cssOf(dist)}`);
    expect(css).toMatch(/url\("\/app\/assets\/bg-[\w-]+\.png"\)/);
    expect(dist.some((f) => /^assets\/bg-[\w-]+\.png$/.test(f))).toBe(true);
  });

  it("inlines @import and resolves url() relative to the imported file", async () => {
    const { dir, dist } = await build({
      "index.html": page(),
      "src/main.ts": `import "./style.css";`,
      "src/style.css": `@import "./sub/base.css";\n.app { color: red; }`,
      "src/sub/base.css": `.base { background: url(./bg.png); }`,
      "src/sub/bg.png": `PNG`,
    });
    const css = await read(dir, `dist/${cssOf(dist)}`);
    // imported rule is inlined, before the importing rule
    expect(css).toContain(".app{color:red}");
    expect(css.indexOf(".base")).toBeLessThan(css.indexOf(".app"));
    // url() inside the imported file resolved against sub/
    expect(css).toMatch(/url\("\/assets\/bg-[\w-]+\.png"\)/);
    expect(dist.some((f) => /^assets\/bg-[\w-]+\.png$/.test(f))).toBe(true);
  });

  it("leaves external and absolute url() untouched", async () => {
    const { dir, dist } = await build({
      "index.html": page(),
      "src/main.ts": `import "./s.css";`,
      "src/s.css": `.a{background:url(https://x.com/a.png)}.b{background:url(/pub.png)}`,
    });
    const css = await read(dir, `dist/${cssOf(dist)}`);
    expect(css).toContain("https://x.com/a.png");
    expect(css).toContain("/pub.png");
  });

  it("scopes CSS modules and exposes the class map to JS", async () => {
    const { dir, dist } = await build({
      "index.html": page(),
      "src/main.ts": `import s from "./B.module.css";\ndocument.body.className = s.btn;`,
      "src/B.module.css": `.btn { color: red; }`,
    });
    const css = await read(dir, `dist/${cssOf(dist)}`);
    const scoped = css.match(/\.(\w+_btn)\s*\{/)?.[1];
    expect(scoped).toBeTruthy();
    expect(await read(dir, `dist/${entryJs(dist)}`)).toContain(scoped!);
  });

  it("compiles Sass (variables + nesting)", async () => {
    const { dir, dist } = await build({
      "index.html": page(),
      "src/main.ts": `import "./t.scss";`,
      "src/t.scss": `$c: green;\n.t { color: $c; .i { margin: 0; } }`,
    });
    const css = await read(dir, `dist/${cssOf(dist)}`);
    expect(css).toContain(".t{color:green}");
    expect(css).toContain(".t .i{margin:0}");
  });

  it("compiles Less", async () => {
    const { dir, dist } = await build({
      "index.html": page(),
      "src/main.ts": `import "./l.less";`,
      "src/l.less": `@w: 4px;\n.l { padding: @w; }`,
    });
    expect(await read(dir, `dist/${cssOf(dist)}`)).toContain(".l{padding:4px}");
  });

  it("code-splits CSS for lazy chunks with a runtime loader", async () => {
    const { dir, dist } = await build({
      "index.html": page(),
      "src/main.ts": `document.body.onclick = () => import("./lazy.ts");`,
      "src/lazy.ts": `import "./lazy.css";\nexport const run = () => 1;`,
      "src/lazy.css": `.lz { display: flex; }`,
    });
    expect(dist.filter((f) => f.endsWith(".css")).length).toBeGreaterThanOrEqual(1);
    const lazyJs = dist.find((f) => /lazy-[\w-]+\.js$/.test(f))!;
    expect(await read(dir, `dist/${lazyJs}`)).toContain('rel="stylesheet"');
  });

  it("runs PostCSS when a config is present", async () => {
    const { dir, dist } = await build({
      "index.html": page(),
      "src/main.ts": `import "./s.css";`,
      "src/s.css": `.x { color: RED; }`,
      "postcss.config.cjs":
        `module.exports = { plugins: [{ postcssPlugin: 'r',` +
        ` Declaration(d){ if (d.value === 'RED') d.value = 'tomato'; } }] };`,
    });
    const css = await read(dir, `dist/${cssOf(dist)}`);
    expect(css).toContain("tomato");
    expect(css).not.toContain("RED");
  });
});
