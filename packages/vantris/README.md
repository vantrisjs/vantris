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
  content-hashed output, source maps, and `build --watch`.
- **Library mode** — bundle one entry to `esm` + `cjs` + `iife` in one build.
- **CSS** — `url()` rewriting, `@import` inlining, CSS Modules, Sass/Less,
  PostCSS, CSS code splitting (via lightningcss).
- **Assets** — images, fonts, media, `wasm`, `txt`, and `json`; hashed and
  rewritten, consistent in dev and build. `public/` is copied verbatim.
- **`define`** — inline global constants in dev and build.
- **Env & modes** — `.env` files per mode, `import.meta.env`, `--mode`.
- **Aliases** — one resolver for dev/build/HTML/CSS, with `tsconfig.json`
  fallback.
- **Cache** — transparent, self-invalidating, in `node_modules/.vantris/`.

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

  // Inlined in dev and build (string | number | boolean)
  define: { __DEV__: true, __APP_VERSION__: "1.0.0" },

  build: {
    minify: true,
    sourcemap: false,   // or true | "inline" | "hidden"  (JS, TS, and CSS)
    emptyOutDir: true,  // empty outDir before building (guarded)
    assetsDir: "assets",
    entryFileNames: "assets/[name]-[hash].js",
    chunkFileNames: "assets/[name]-[hash].js",
    assetFileNames: "assets/[name]-[hash][extname]",
    // Library mode — bundle one entry to several formats:
    // lib: { entry: "./src/index.ts", name: "MyLib", formats: ["esm", "cjs", "iife"] },
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

### Library mode

```ts
export default defineConfig({
  build: {
    lib: { entry: "./src/index.ts", name: "MyLib", formats: ["esm", "cjs", "iife"] },
  },
});
```

Emits `index.mjs` (esm), `index.cjs` (cjs), and `index.iife.js` (iife — needs
`name`) in one build. Defaults to `["esm", "cjs"]`; `fileName` defaults to the
entry's base name. The HTML pipeline is skipped.

### `vantris build --watch`

Rebuilds on every change without starting a dev server — debounced, and a
failed build never stops the watcher.

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

If you don't set `resolve.alias`, Vantris reads `compilerOptions.paths` and
`baseUrl` from your `tsconfig.json` (following `extends`), so a single source of
truth drives both the type-checker and the bundler. An explicit `resolve.alias`
always wins.

## TypeScript

Vantris ships ambient client types (`import.meta.env`, asset/CSS module
imports). Reference them once — no hand-written `.d.ts` needed. The recommended
`tsconfig.json` for app code:

```jsonc
{
  "compilerOptions": {
    // App code is bundled, so use bundler resolution.
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Types for import.meta.env and asset/CSS imports.
    "types": ["vantris/client"],

    // Match your resolve.alias for editor/type support.
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`types: ["vantris/client"]` types `import.meta.env`; the `paths` entry mirrors
your `resolve.alias` so the type-checker follows aliased imports. (You can also
use `/// <reference types="vantris/client" />` instead of the `types` entry.)

## Requirements

- Node.js >= 20.11
- Sass/Less are optional — install `sass` or `less` only if you use them.

## License

MIT
