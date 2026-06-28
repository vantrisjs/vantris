# Vantris

A modern, fast bundler for JavaScript/TypeScript — **v0.4.0**.

Vantris gives you a complete development cycle behind three commands —
`dev`, `build`, and `preview` — powered by [H3](https://h3.dev/),
[esbuild](https://esbuild.github.io/), [Rolldown](https://rolldown.rs/), and
[lightningcss](https://lightningcss.dev/). The underlying engines stay internal;
you configure Vantris, never them.

## Features

- ⚡ **Dev server** — H3 server, on-the-fly TypeScript via esbuild, full-page
  live reload over WebSocket.
- 📦 **Production build** — Rolldown bundling: tree shaking, minification, code
  splitting, content-hashed output.
- 🎨 **Full CSS pipeline** — `url()` rewriting, `@import` inlining, CSS Modules,
  Sass/Less, PostCSS, and CSS code splitting.
- 🖼️ **Asset handling** — JS-imported assets and `src/`-referenced HTML assets
  are hashed and rewritten; `public/` is copied verbatim.
- 👀 **Preview server** — serve the real production output locally.
- 🧪 **Well tested & strict** — 60+ Vitest tests, TypeScript strict everywhere.

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

| Command           | Description                                         |
| ----------------- | --------------------------------------------------- |
| `vantris dev`     | Start the development server with live reload.      |
| `vantris build`   | Produce an optimised production build in `outDir`.  |
| `vantris preview` | Serve the built `outDir` locally (no compilation).  |

Global flags: `--help` / `-h`, `--version` / `-v`, `--verbose` / `--debug`.

The CLI only parses arguments and routes to a command — all behaviour lives in
the command modules.

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

  // Production build
  build: {
    minify: true,            // or false
    sourcemap: false,        // or true | "inline" | "hidden"
    assetsDir: "assets",     // drives the default *FileNames below
    entryFileNames: "assets/[name]-[hash].js",
    chunkFileNames: "assets/[name]-[hash].js",
    assetFileNames: "assets/[name]-[hash][extname]",
  },

  // Preview server
  preview: {
    port: 4173,
    host: "localhost",
    open: false,             // open the browser on start
  },
});
```

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
