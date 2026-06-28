import { afterEach, describe, expect, it } from "vitest";
import { buildProject as build, cleanupProjects, read } from "./helpers.js";

afterEach(cleanupProjects);

const page = (head = "", body = "") =>
  `<!doctype html><html><head>${head}</head><body>${body}` +
  `<script type="module" src="/src/main.ts"></script></body></html>`;

describe("CSS imported from JS", () => {
  it("emits a hashed stylesheet and injects a <link>", async () => {
    const { dir, dist } = await build({
      "index.html": page(),
      "src/main.ts": `import "./style.css";\nconsole.log(1);`,
      "src/style.css": `.app { color: red; margin: 0; }`,
    });
    const css = dist.find((f) => f.endsWith(".css"));
    expect(css).toMatch(/^assets\/main-[\w-]+\.css$/);

    const html = await read(dir, "dist/index.html");
    expect(html).toContain(`<link rel="stylesheet" href="/${css}">`);
    // minified by default
    expect((await read(dir, `dist/${css}`)).trim()).toBe(".app{color:red;margin:0}");
  });

  it("leaves CSS unminified when minify is off", async () => {
    const { dir, dist } = await build(
      {
        "index.html": page(),
        "src/main.ts": `import "./style.css";`,
        "src/style.css": `.x {\n  color: blue;\n}`,
      },
      { build: { minify: false } },
    );
    const css = dist.find((f) => f.endsWith(".css"))!;
    expect(await read(dir, `dist/${css}`)).toContain("\n");
  });
});

describe("HTML asset references", () => {
  it("rewrites src/href that point into rootDir, hashing them", async () => {
    const { dir, dist } = await build({
      "index.html": page(
        `<link rel="icon" href="/src/favicon.svg">` +
          `<link rel="stylesheet" href="/src/page.css">`,
        `<img src="/src/banner.png">`,
      ),
      "src/main.ts": `console.log(1);`,
      "src/favicon.svg": `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
      "src/page.css": `body { background: white; }`,
      "src/banner.png": `PNGDATA`,
    });

    const html = await read(dir, "dist/index.html");
    expect(html).toMatch(/href="\/assets\/favicon-[\w-]+\.svg"/);
    expect(html).toMatch(/href="\/assets\/page-[\w-]+\.css"/);
    expect(html).toMatch(/src="\/assets\/banner-[\w-]+\.png"/);
    expect(html).not.toContain("/src/favicon.svg");

    expect(dist.some((f) => /^assets\/favicon-[\w-]+\.svg$/.test(f))).toBe(true);
    expect(dist.some((f) => /^assets\/page-[\w-]+\.css$/.test(f))).toBe(true);
    expect(dist.some((f) => /^assets\/banner-[\w-]+\.png$/.test(f))).toBe(true);
  });

  it("leaves public and external references untouched", async () => {
    const { dir } = await build({
      "index.html": page(
        `<link rel="stylesheet" href="https://cdn.example.com/x.css">`,
        `<img src="/logo.png">`,
      ),
      "src/main.ts": `console.log(1);`,
      "public/logo.png": `PUBLIC`,
    });
    const html = await read(dir, "dist/index.html");
    expect(html).toContain(`href="https://cdn.example.com/x.css"`);
    expect(html).toContain(`src="/logo.png"`);
  });

  it("prefixes rewritten asset URLs with base", async () => {
    const { dir } = await build(
      {
        "index.html": page(`<link rel="icon" href="/src/icon.svg">`),
        "src/main.ts": `console.log(1);`,
        "src/icon.svg": `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
      },
      { base: "/app/" },
    );
    const html = await read(dir, "dist/index.html");
    expect(html).toMatch(/href="\/app\/assets\/icon-[\w-]+\.svg"/);
  });
});
