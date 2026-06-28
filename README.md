# Vantris

A modern bundler for JavaScript/TypeScript — **v0.1.0**.

This is a pnpm monorepo laying the long-term foundation for a serious bundler.
v0.1.0 ships only the base: CLI, configuration loading, internal structure, and
HTML entry detection. The dev server, build pipeline, transforms, HMR, and
plugin system are scaffolded as architectural seams but intentionally not yet
implemented.

## Layout

```text
.
├── packages/
│   └── vantris/        # the core package
├── playground/         # local test project consuming `vantris`
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Getting started

```bash
pnpm install
pnpm build            # compile the vantris package
pnpm test             # run the test suite (Vitest)
pnpm typecheck        # strict type-check every package

# drive the CLI from the playground (uses the workspace package)
pnpm play:dev
pnpm play:build
pnpm play:preview
```

## Package architecture (`packages/vantris/src`)

| Module      | Responsibility                                          |
| ----------- | ------------------------------------------------------- |
| `cli/`      | Argument parsing + routing only — no command logic.     |
| `commands/` | One module per command (`dev`, `build`, `preview`).     |
| `config/`   | `defineConfig`, config loading, defaults, resolution.   |
| `html/`     | HTML entry detection, module-script analysis, dev-client injection. |
| `server/`   | H3 dev server: routing, static serving, esbuild transpile, WebSocket reload. |
| `build/`    | Rolldown build pipeline: bundle, HTML, assets, output (split by responsibility). |
| `preview/`  | Preview seam (planned: static server over `outDir`).    |
| `shared/`   | Context factory, logger, file watcher, errors, constants. |
| `types/`    | Public & internal type contracts.                       |
| `utils/`    | Small filesystem & path helpers.                        |

### Design principles

- **TypeScript strict** throughout (`tsconfig.base.json`).
- **No logic in the CLI** — it only routes to the command registry.
- **Dependency injection** — commands receive a `Context` (config, logger);
  there is no hidden global state.
- **Strong separation of concerns** so future subsystems drop into their seam
  without a rewrite.

## Configuration

Create `vantris.config.ts` (or `.js` / `.mjs`) at the project root:

```ts
import { defineConfig } from "vantris";

export default defineConfig({
  rootDir: "./src",      // default
  publicDir: "./public", // default
  outDir: "./dist",      // default
  base: "/",             // default — public base path for built URLs
  dev: {
    port: 3000,          // default
    host: "localhost",   // default
  },
  build: {
    minify: true,         // default
    sourcemap: false,     // default — or true | "inline" | "hidden"
    assetsDir: "assets",  // default — drives the *FileNames patterns below
    entryFileNames: "assets/[name]-[hash].js",      // default
    chunkFileNames: "assets/[name]-[hash].js",      // default
    assetFileNames: "assets/[name]-[hash][extname]", // default
  },
});
```

All fields are optional; the defaults above apply when omitted. Build output
options (`entryFileNames`, `chunkFileNames`, `assetFileNames`) are first-class
and Vantris-owned — there is no `rolldownOptions` escape hatch and the bundler
is never exposed. Each accepts a **string pattern or a function**:

```ts
build: {
  // function form — receives a Vantris ChunkInfo / AssetInfo
  entryFileNames: (chunk) => `js/${chunk.name}.[hash].js`,
  assetFileNames: (asset) => `media/${asset.names[0]}`,
}
```

## Dev server (v0.2.0)

```bash
pnpm play:dev          # runs `vantris dev` in the playground
```

`vantris dev` starts an H3 server that serves `index.html`, transpiles
TypeScript on the fly with esbuild (transform only — no bundling), and live-
reloads the browser on file changes via an injected WebSocket client.

Serving follows a Vite-style allowlist: source modules come from `rootDir`
(`/src/*`), `public/` contents are served at `/`, and everything else under the
project root (`node_modules`, `package.json`, lockfiles, config files) is **not**
reachable. HMR is intentionally **not** part of this version.

## Production build (v0.3.0)

```bash
pnpm play:build        # runs `vantris build` in the playground
```

`vantris build` cleans `outDir`, analyses `index.html` to find the
`<script type="module">` entry, and bundles the app with
[Rolldown](https://rolldown.rs/) — tree shaking, minification, and code
splitting included. The emitted `dist/index.html` is rewritten to reference the
hashed output, and `public/` is copied verbatim.

What gets processed (Vite-style):

- **JS-imported assets** (`import url from "./logo.svg"`) → hashed files with
  **absolute** URLs derived from `base`.
- **CSS** (`import "./style.css"`) → collected per entry, processed with
  [lightningcss](https://lightningcss.dev/), emitted as a hashed `.css` with a
  `<link>` injected. Includes **`url()` rewriting**, **CSS Modules**
  (`*.module.css`), **Sass/Less** (when installed), **PostCSS** (when a
  `postcss.config.*` exists), and **CSS code splitting** for lazy chunks.
- **HTML `src`/`href`** in `<link>`/`<img>`/`<script>` that point **into
  `rootDir`** (e.g. `/src/icon.svg`) → hashed and rewritten. Public and external
  references (`/logo.png`, `https://…`) are left untouched.

Rolldown is an internal dependency and is never exposed in the public config.
HMR and a plugin system are intentionally **not** part of this version.
