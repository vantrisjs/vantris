# Changelog

All notable changes to Vantris are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Reserved for future versions. Planned: env variables (`import.meta.env`), HMR,
and a plugin system._

## [0.4.0] - 2026-06-28

Preview server and developer-experience polish, completing the dev cycle:
`dev`, `build`, and `preview` all work.

### Added

- **Preview command** — `vantris preview` serves the finished build from
  `outDir` over an H3 server, with no compilation. Correct content types, SPA
  fallback to `index.html`, and a 404 for missing assets. Honours a custom
  `base` (sub-path deploys): base-prefixed request URLs map back to `outDir`.
- **Preview config** — new `preview` option (`PreviewConfig`: `port` (4173),
  `host` (`localhost`), `open` (`false`)).
- **Auto-open** — `preview.open: true` launches the default browser
  (cross-platform: macOS/Windows/Linux).
- **Network URL** — the preview prints the local URL, the served directory, and
  the startup time. The LAN URL is shown **only** when bound to a wildcard host
  (`0.0.0.0`/`::`); a loopback host shows no (unreachable) network URL.
- **Errors** — `PreviewError` (missing build output) and `ServerError` (port in
  use), both `VantrisError` subclasses with explicit messages.
- **Tests** — preview server, SPA fallback, browser-open (mocked), errors, and
  preview config resolution (62 tests total).

### Changed

- The dev and preview servers now share a single HTTP bootstrap
  (`server/node.ts`: app creation, `listen` with actual-port reporting, close);
  `waitForShutdown` is shared by the `dev` and `preview` commands. No public API
  changes.
- Documentation overhauled: Getting Started, CLI, Configuration, and per-command
  (Dev/Build/Preview) sections with examples.

## [0.3.0] - 2026-06-28

Production build system. `vantris build` bundles the app with
[Rolldown](https://rolldown.rs/) into an optimised `dist/`. Rolldown is an
internal dependency — its API is never exposed to users.

### Added

- **Build command** — `vantris build` produces an optimised build into
  `outDir`, cleaning the directory first.
- **Build pipeline** — split by responsibility under `build/`: `bundle.ts`
  (Rolldown integration), `html.ts` (entry resolution + output HTML),
  `assets.ts` (public copy), `output.ts` (clean + write), and `index.ts`
  (orchestration, logging, timing).
- **Rolldown bundling** — bundling, tree shaking, minification, and code
  splitting. Vantris translates its own config into Rolldown's options; the
  bundler stays entirely internal.
- **HTML-driven entry** — `index.html` is analysed and its
  `<script type="module">` becomes the build entry; the emitted
  `dist/index.html` is rewritten to reference the hashed output.
- **Public assets** — `public/` is copied verbatim into `dist/` (before the
  generated HTML, which takes precedence over any `public/index.html`).
- **JS-imported assets** — images, fonts, and media imported from JS
  (`import url from "./logo.svg"`) are emitted as hashed files with **absolute**
  URLs derived from `base`, so they resolve under any deploy path. Handled by an
  internal bundler plugin (Rolldown is still never exposed); source maps stay
  accurate via `magic-string`.
- **CSS pipeline** — a full, Vite-style CSS pipeline (Rolldown no longer bundles
  CSS; Vantris handles it internally via [lightningcss](https://lightningcss.dev/)):
  - `import "./style.css"` → collected per entry, emitted as a hashed `.css`,
    `<link>` injected into the HTML.
  - **`url()` rewriting** — `url(./img.png)` inside CSS is hashed, emitted, and
    rewritten (absolute from `base`); external/public URLs are left alone.
  - **`@import` inlining** — `@import "./other.css"` is resolved and inlined
    (each imported file goes through preprocessing + PostCSS, and its `url()`s
    resolve relative to itself).
  - **CSS Modules** — `*.module.css` are scoped and expose a class map to JS
    (`import styles from "./x.module.css"`).
  - **Preprocessors** — `.scss`/`.sass`/`.less` compiled when `sass`/`less` are
    installed (optional peer deps).
  - **PostCSS** — runs automatically when a `postcss.config.*` is present
    (Tailwind, autoprefixer, …).
  - **CSS code splitting** — CSS imported by a dynamically-imported chunk is
    emitted separately and loaded at runtime when that chunk loads.
  - Minification and nesting/modern-CSS lowering via lightningcss.
- **HTML asset references** — `src`/`href` in `<link>`, `<img>`, `<script>`,
  `<source>` that point **into `rootDir`** (e.g. `/src/icon.svg`,
  `/src/page.css`) are hashed, emitted, and rewritten (stylesheets go through
  the full CSS pipeline). Public and external references (`/logo.png`,
  `https://…`) are left untouched.
- **`base` option** — public base path (default `/`), prefixed to built asset
  and entry URLs for deploys under a sub-path or CDN.
- **Multiple HTML entries** — every `<script type="module">` in `index.html`
  becomes a bundler entry (each rewritten to its hashed output), not just the
  first. `BuildResult` reports `entries: { src, fileName }[]`.
- **Test suite** — [Vitest](https://vitest.dev/) (run with `pnpm test`) covering:
  - config resolution, HTML parsing/injection;
  - the full build pipeline (bundling, tree shaking, code splitting, asset URLs,
    source maps, multi-entry, public copy, cleaning, every error path);
  - the CSS pipeline (`url()`, `@import`, CSS Modules, Sass, Less, PostCSS,
    lazy code splitting);
  - the **dev server** (HTTP transpile-on-the-fly, the Vite-style serving
    allowlist, WebSocket live reload) and the file watcher.
- The dev server now reports the **actual** bound port (so `port: 0` works for
  an OS-assigned port).
- **Configuration** — new `build` option (`BuildConfig`): `minify`,
  `sourcemap` (`boolean | "inline" | "hidden"`), `assetsDir`, and first-class
  output naming (`entryFileNames`, `chunkFileNames`, `assetFileNames`). Each
  naming option accepts a **string pattern or a function** over a Vantris-owned
  `ChunkInfo`/`AssetInfo`. All Vantris-owned and Vantris-typed — no
  `rolldownOptions` escape hatch, the bundler is never exposed. Shaped to grow
  (target, manifest, plugins…).
- **Errors** — `BuildError` (a `VantrisError`) with explicit messages; an
  `outDir` safety guard refuses to clean a directory overlapping the project.

## [0.2.0] - 2026-06-27

Development server. `vantris dev` now serves a project, compiles TypeScript on
the fly, and live-reloads the browser on file changes. HMR, plugins, and the
build system remain out of scope (scaffolded as seams only).

### Added

- **Dev server** — `vantris dev` starts an [H3](https://h3.dev/) v2 server that
  serves the `index.html` entry, resolves source modules from `rootDir`
  (`/src/*`), serves `publicDir` contents at `/` (Vite-style), and falls back to
  the entry for navigation requests. The serveable surface is an allowlist:
  only the source tree and public dir are exposed — `node_modules`,
  `package.json`, lockfiles, config files, and path traversal are blocked.
- **On-the-fly TypeScript** — `.ts`/`.tsx` modules are transpiled per request
  with [esbuild](https://esbuild.github.io/) (transform only — no bundling, no
  production optimisation) and served as ESM with inline source maps.
- **Live reload** — a `shared/watcher.ts` (chokidar) watches `rootDir`; changes
  are pushed over a WebSocket (sharing the HTTP port) to a client script
  injected into the HTML, triggering a full page reload.
- **HTML pipeline** — `html/` now analyses `<script type="module">` entries and
  injects the dev client, structured to grow toward HMR, plugin transforms, and
  virtual modules.
- **Configuration** — new `dev` option (`DevConfig`: `port`, `host`), defaulting
  to `port: 3000`, `host: "localhost"`.

### Changed

- `startDevServer()` now returns a `DevServerHandle` (url, `broadcastReload()`,
  `close()`); the `dev` command orchestrates server + watcher and shuts both
  down cleanly on `SIGINT`/`SIGTERM`.

## [0.1.0] - 2026-06-27

First public foundation release. This version intentionally ships only the
base architecture for a long-term bundler — the engines (dev server, build,
transforms, HMR, plugins) are scaffolded as seams but not yet implemented.

### Added

- **Monorepo** — pnpm workspace with `packages/vantris` (core) and
  `playground/` (local test project), plus a shared `tsconfig.base.json` in
  TypeScript strict mode.
- **CLI** — extensible `vantris` binary with `dev`, `build`, and `preview`
  commands. The CLI only parses arguments and routes to a command registry;
  it contains no command logic, so new commands require no CLI refactor.
- **Configuration** — `defineConfig()` helper and a `Config` interface.
  Loads `vantris.config.ts`, `.js`, or `.mjs` from the project root via the
  Node runtime's native TypeScript support. The loader is isolated so the
  strategy can change without affecting callers.
- **Defaults** — `rootDir = ./src`, `publicDir = ./public`, `outDir = ./dist`,
  resolved to absolute paths in a single place.
- **HTML entry detection** — isolated `html/` module that detects and parses
  the project's `index.html`.
- **Architecture** — dependency-injected `Context` (config + logger), no
  hidden global state, typed error hierarchy, and reserved seams for the dev
  server, build pipeline, and preview server.
- **Build** — bundled with [tsup](https://tsup.egoist.dev/) to ESM with type
  declarations; type-checking via `tsc --noEmit`.

[Unreleased]: https://github.com/vantrisjs/vantris/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/vantrisjs/vantris/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/vantrisjs/vantris/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/vantrisjs/vantris/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vantrisjs/vantris/releases/tag/v0.1.0
