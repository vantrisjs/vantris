# Vantris

A modern, fast bundler for JavaScript/TypeScript — **v0.6.0**.

Vantris gives you a complete development cycle behind three commands —
`dev`, `build`, and `preview` — powered by [H3](https://h3.dev/),
[esbuild](https://esbuild.github.io/), [Rolldown](https://rolldown.rs/), and
[lightningcss](https://lightningcss.dev/). The underlying engines stay internal;
you configure Vantris, never them.

## Features

- ⚡ **Dev server** — H3 server, on-the-fly TypeScript via esbuild, full-page
  live reload over WebSocket.
- 📦 **Production build** — Rolldown bundling: tree shaking, minification, code
  splitting, content-hashed output, with `build --watch`.
- 📚 **Library mode** — bundle one entry to `esm` + `cjs` + `iife` in a single
  build.
- 🗺️ **Source maps** — for JS, TS, and CSS (`true` / `"inline"` / `"hidden"`).
- 🎨 **Full CSS pipeline** — `url()` rewriting, `@import` inlining, CSS Modules,
  Sass/Less, PostCSS, and CSS code splitting.
- 🖼️ **Asset handling** — images, fonts, media, `wasm`, `txt`, and `json`;
  consistent in dev and build. `public/` is copied verbatim.
- 🔧 **`define`** — inline global constants in dev and build.
- 🧭 **Zero-config aliases** — falls back to `tsconfig.json` `paths`/`baseUrl`.
- ⚙️ **Internal cache** — transparent, self-invalidating, in `node_modules/`.
- 👀 **Preview server** — serve the real production output locally.
- 🧪 **Well tested & strict** — 200+ Vitest tests, TypeScript strict everywhere.

## Getting started

A Vantris project is an `index.html` with a module script entry:

```text
my-app/
├── index.html
├── public/             # static assets, served/copied as-is
├── src/
│   └── main.ts
└── vantris.config.ts   # optional
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

Then drive the three commands:

```bash
vantris dev       # start the dev server (http://localhost:3000)
vantris build     # build to dist/
vantris preview   # serve dist/ (http://localhost:4173)
```

## CLI

| Command                 | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `vantris dev`           | Start the development server with live reload.      |
| `vantris build`         | Produce an optimised production build in `outDir`.  |
| `vantris build --watch` | Rebuild on every change (no dev server).            |
| `vantris preview`       | Serve the built `outDir` locally (no compilation).  |

Global flags: `--mode <mode>`, `--watch` / `-w` (build), `--help` / `-h`,
`--version` / `-v`, `--verbose` / `--debug`.

The CLI only parses arguments and routes to a command — all behaviour lives in
the command modules.

## Modes & environment variables

Each command runs in a **mode** — `dev` defaults to `development`, `build` and
`preview` to `production`. Override it with `--mode`:

```bash
vantris dev --mode staging
vantris build --mode production
vantris preview --mode local
```

The mode selects which `.env` files load (later files override earlier):

```text
.env
.env.local
.env.[mode]
.env.[mode].local
```

Only variables prefixed `VANTRIS_` are exposed to client code via
`import.meta.env` (so secrets in `.env` never reach the bundle), along with the
built-ins `MODE`, `DEV`, `PROD`, and `BASE_URL`:

```ts
// .env.production → VANTRIS_API=https://api.example.com
console.log(import.meta.env.VANTRIS_API); // "https://api.example.com"
console.log(import.meta.env.MODE, import.meta.env.PROD); // "production" true
```

## Aliases

A single resolver applies `resolve.alias` everywhere — dev, build, HTML, and
CSS:

```ts
import { thing } from "@/thing";   // JS/TS
@import "@/styles/base.css";        /* CSS */
```
```html
<link rel="icon" href="@/favicon.svg" />
```

## Configuration

Create `vantris.config.ts` (or `.js` / `.mjs`) at the project root. Every field
is optional; the defaults below apply when omitted.

```ts
import { defineConfig } from "vantris";

export default defineConfig({
  // Paths
  root: ".",             // project root
  rootDir: "./src",      // source directory
  publicDir: "./public", // static assets, served at / and copied verbatim
  outDir: "./dist",      // build output
  base: "/",             // public base path, prefixed to built URLs

  // Dev server
  dev: {
    port: 3000,
    host: "localhost",
  },

  // Global constant replacements (inlined in dev and build)
  define: {
    __DEV__: true,
    __APP_VERSION__: "1.0.0",
  },

  // Production build
  build: {
    minify: true,            // or false
    sourcemap: false,        // or true | "inline" | "hidden"
    emptyOutDir: true,       // empty outDir before building (safely)
    assetsDir: "assets",     // drives the default *FileNames below
    entryFileNames: "assets/[name]-[hash].js",
    chunkFileNames: "assets/[name]-[hash].js",
    assetFileNames: "assets/[name]-[hash][extname]",
    // lib: { ... }          // build a library instead of an app (see below)
  },

  // Preview server
  preview: {
    port: 4173,
    host: "localhost",
    open: false,             // open the browser on start
  },

  // Module resolution
  resolve: {
    alias: {
      "@": "./src",          // import x from "@/utils"
      "~": "./shared",
    },
  },
});
```

When `resolve.alias` is **omitted**, Vantris falls back to your
`tsconfig.json` — `compilerOptions.paths` (resolved against `baseUrl`) become
your aliases, so `"@/*": ["./src/*"]` works with zero extra config. An explicit
`resolve.alias` always takes precedence.

The config is validated on load: an invalid value fails fast with the property
path, the expected type, and the value received.

Output naming options are Vantris-owned (no `rolldownOptions` escape hatch) and
each accepts a **string pattern or a function**:

```ts
build: {
  entryFileNames: (chunk) => `js/${chunk.name}.[hash].js`,
  assetFileNames: (asset) => `media/${asset.names[0]}`,
}
```

## Dev (`vantris dev`)

Starts an H3 server that:

- serves `index.html`,
- transpiles `.ts`/`.tsx` on the fly with esbuild (transform only — no bundling),
- live-reloads the browser on file changes via an injected WebSocket client.

Serving follows a Vite-style allowlist: source modules come from `rootDir`
(`/src/*`), `public/` contents are served at `/`, and everything else under the
project root (`node_modules`, `package.json`, lockfiles, config files) is **not**
reachable.

## Build (`vantris build`)

Cleans `outDir`, analyses `index.html` for `<script type="module">` entries
(multiple supported), and bundles with Rolldown — tree shaking, minification,
and code splitting. The emitted `dist/index.html` is rewritten to the hashed
output, and `public/` is copied verbatim.

What gets processed (Vite-style):

- **JS-imported assets** (`import url from "./logo.svg"`) → hashed files with
  **absolute** URLs derived from `base`.
- **CSS** (`import "./style.css"`) → processed with lightningcss, emitted as a
  hashed `.css` with a `<link>` injected. Includes `url()` rewriting, `@import`
  inlining, **CSS Modules** (`*.module.css`), **Sass/Less** (when installed),
  **PostCSS** (when a `postcss.config.*` exists), and **CSS code splitting** for
  lazy chunks.
- **HTML `src`/`href`** in `<link>`/`<img>`/`<script>` that point **into
  `rootDir`** → hashed and rewritten. Public and external references are left
  untouched.

Sass/Less are optional peer dependencies — install the one you use
(`pnpm add -D sass`).

**Assets.** Images (`png`, `jpg`, `gif`, `svg`, `webp`, `avif`, `ico`, `bmp`),
fonts (`woff`, `woff2`, `ttf`, `otf`, `eot`), media (`mp4`, `webm`, `mp3`,
`wav`, …), plus `wasm` and `txt` resolve to hashed URLs when imported, while
`json` is imported as data. They behave identically in dev and build.

**Source maps.** `build.sourcemap` covers JavaScript, TypeScript, and CSS:

| value        | result                                              |
| ------------ | --------------------------------------------------- |
| `false`      | no maps (default)                                   |
| `true`       | external `.map` files + a `sourceMappingURL` comment |
| `"inline"`   | map embedded as a base64 data URL                   |
| `"hidden"`   | external `.map` files, no comment                   |

**Watch.** `vantris build --watch` (or `-w`) rebuilds on every change. It does
**not** start a dev server — it only rebuilds, debounced, and a failed build
never stops the watcher.

```bash
vantris build --watch
```

**`base`** is applied consistently across HTML, CSS `url()`, injected
stylesheets, and JS-imported assets. Dynamic-import chunks stay relative, so
they resolve correctly under any base.

### Library mode (`build.lib`)

Bundle a single entry into multiple distribution formats in one build:

```ts
export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.ts",
      name: "MyLibrary",          // required for the "iife" global
      formats: ["esm", "cjs", "iife"], // default: ["esm", "cjs"]
      // fileName: "my-library",   // default: the entry's base name
    },
  },
});
```

Each format is emitted with its own extension — `.mjs` (esm), `.cjs` (cjs),
`.iife.js` (iife) — and the HTML pipeline is skipped. The module graph is built
once and written once per format.

### Global constants (`define`)

`define` replaces identifiers with a JSON literal everywhere they appear, in
both dev and build, so flags and metadata are inlined (and dead branches
tree-shaken):

```ts
export default defineConfig({
  define: { __DEV__: false, __APP_VERSION__: "1.0.0" },
});
```

```ts
if (__DEV__) console.log("dev only"); // dropped in production
console.log(__APP_VERSION__);          // → console.log("1.0.0")
```

Values are `string`, `number`, or `boolean`.

### Internal cache

Vantris keeps a transparent, self-invalidating cache in
`node_modules/.vantris/` — transpiled dev modules (content-addressed) and build
metadata. It is wiped automatically when the Vantris version or your config
changes, and never touches the project root. No configuration needed.

## Preview (`vantris preview`)

Serves the finished build from `outDir` exactly as produced — **no
compilation**, the closest mirror of production:

- static files with correct content types,
- SPA fallback to `index.html` for client-side routes,
- local **and** network URLs printed on start,
- optional `open: true` to launch the browser (macOS/Windows/Linux).

```bash
vantris build && vantris preview
```

It fails fast with a clear error if `outDir` doesn't exist (run `build` first)
or the port is in use.

## Monorepo & architecture

```text
.
├── packages/vantris/   # the core package
├── playground/         # local test project consuming `vantris`
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

```bash
pnpm install
pnpm build       # compile the vantris package
pnpm test        # Vitest suite
pnpm typecheck   # strict type-check every package
pnpm play:dev    # run `vantris dev` in the playground (play:build, play:preview)
```

Internal modules (`packages/vantris/src`):

| Module      | Responsibility                                                          |
| ----------- | ---------------------------------------------------------------------- |
| `cli/`      | Argument parsing + routing only — no command logic.                    |
| `commands/` | One module per command (`dev`, `build`, `preview`).                    |
| `config/`   | `defineConfig`, config loading, defaults, resolution.                  |
| `html/`     | HTML entry detection, module-script analysis, dev-client injection.    |
| `server/`   | Dev server: H3 routing, static serving, transpile, WebSocket reload.   |
| `build/`    | Rolldown build pipeline: bundle, HTML, CSS, assets, output.            |
| `preview/`  | Preview server: static serving over `outDir` with SPA fallback.        |
| `shared/`   | Context factory, logger, file watcher, errors, constants.              |
| `types/`    | Public & internal type contracts.                                      |
| `utils/`    | Filesystem, paths, network, and browser-open helpers.                  |

### Design principles

- **TypeScript strict** throughout (`tsconfig.base.json`).
- **No logic in the CLI** — it only routes to the command registry.
- **Dependency injection** — commands receive a `Context` (config, logger);
  no hidden global state.
- **Strong separation of concerns** — the dev and preview servers share one
  HTTP bootstrap; new commands and (future) plugins/HMR slot in without
  rewriting existing modules.
- **Errors are explicit** — everything intentional throws a `VantrisError`
  subclass, rendered cleanly by the CLI.
