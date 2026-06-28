# vantris

A modern, fast bundler for JavaScript/TypeScript. One tool, three commands —
`dev`, `build`, `preview` — powered internally by H3, esbuild, Rolldown, and
lightningcss (you configure Vantris, never them).

## Install

```bash
npm install -D vantris
# or: pnpm add -D vantris   /   yarn add -D vantris
```

## Quick start

A Vantris project is an `index.html` with a module-script entry:

```text
my-app/
├── index.html
├── public/            # static assets, served/copied as-is
└── src/
    └── main.ts
```

```html
<!-- index.html -->
<!doctype html>
<html>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

```bash
npx vantris dev       # dev server with live reload  → http://localhost:3000
npx vantris build     # optimised build              → dist/
npx vantris preview   # serve the build              → http://localhost:4173
```

Add scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "vantris dev",
    "build": "vantris build",
    "preview": "vantris preview"
  }
}
```

## What you get

- **Dev** — H3 server, on-the-fly TypeScript (esbuild), full-page live reload.
- **Build** — Rolldown bundling: tree shaking, minification, code splitting,
  content-hashed output.
- **CSS** — `url()` rewriting, `@import` inlining, CSS Modules, Sass/Less,
  PostCSS, CSS code splitting (via lightningcss).
- **Assets** — JS-imported and `src/`-referenced HTML assets are hashed and
  rewritten; `public/` is copied verbatim.
- **Env & modes** — `.env` files per mode, `import.meta.env`, `--mode`.
- **Aliases** — one resolver, applied in dev, build, HTML, and CSS.

## Configuration

Create `vantris.config.ts` (or `.js` / `.mjs`). Every field is optional.

```ts
import { defineConfig } from "vantris";

export default defineConfig({
  root: ".",
  rootDir: "./src",
  publicDir: "./public",
  outDir: "./dist",
  base: "/",

  dev: { port: 3000, host: "localhost" },

  build: {
    minify: true,
    sourcemap: false, // or true | "inline" | "hidden"
    assetsDir: "assets",
    entryFileNames: "assets/[name]-[hash].js",
    chunkFileNames: "assets/[name]-[hash].js",
    assetFileNames: "assets/[name]-[hash][extname]",
  },

  preview: { port: 4173, host: "localhost", open: false },

  resolve: {
    alias: { "@": "./src", "~": "./shared" },
  },
});
```

Output-naming options accept a string pattern **or** a function. The config is
validated on load — an invalid value fails with the property path, expected
type, and received value.

## Modes & environment variables

Each command runs in a **mode** (`dev` → `development`, `build`/`preview` →
`production`). Override with `--mode`:

```bash
vantris dev --mode staging
vantris build --mode production
```

The mode selects which `.env` files load (later overrides earlier):

```text
.env  →  .env.local  →  .env.[mode]  →  .env.[mode].local
```

Only `VANTRIS_`-prefixed variables (plus built-ins `MODE`, `DEV`, `PROD`,
`BASE_URL`) are exposed to client code — secrets in `.env` never reach the
bundle:

```ts
// .env.production → VANTRIS_API=https://api.example.com
console.log(import.meta.env.VANTRIS_API); // "https://api.example.com"
console.log(import.meta.env.MODE, import.meta.env.PROD); // "production" true
```

## Aliases

`resolve.alias` is applied everywhere — JS/TS, CSS, and HTML:

```ts
import { thing } from "@/thing";
```

```css
@import "@/styles/base.css";
.logo { background: url("@/logo.svg"); }
```

## Requirements

- Node.js >= 20.11
- Sass/Less are optional — install `sass` or `less` only if you use them.

## License

MIT
