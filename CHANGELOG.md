# Changelog

All notable changes to Vantris are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Reserved for future versions. Planned: HMR and a plugin system (the resolver,
env, config, cache, and logger layers are already structured to host them)._

## [0.8.0] - 2026-06-30

Completes the bundler core ahead of stabilisation — library output, source
maps, global constants, and a persistent cache, with no breaking changes.

### Added

- **Library mode** (`build.lib`) — bundle one entry into `esm`, `cjs`, and
  `iife` in a single build (`.mjs` / `.cjs` / `.iife.js`); the graph is built
  once and written once per format. `name` (iife global), `formats` (default
  `["esm", "cjs"]`), and `fileName` are configurable; the HTML pipeline is
  skipped.
- **Complete source maps** for JavaScript, TypeScript, **and CSS** —
  `build.sourcemap` honours `false` / `true` / `"inline"` / `"hidden"`
  consistently (lightningcss-generated CSS maps included).
- **Global constants** (`define`) — `string`/`number`/`boolean` values inlined
  as JSON literals in **both** dev and build (merged with `import.meta.env`).
- **`build.emptyOutDir`** (default `true`) — empties `outDir` before building,
  guarded so nothing outside `outDir` is ever removed.
- **`vantris build --watch`** (`-w`) — rebuilds on change without starting a dev
  server; debounced, and a failed build never stops the watcher.
- **Persistent cache** in `node_modules/.vantris/` — transparent and
  self-invalidating (a version/config-fingerprint manifest wipes it on change).
  Backs a content-addressed dev transpile cache and build metadata; never
  pollutes the project root.
- **Zero-config aliases from `tsconfig.json`** — when `resolve.alias` is unset,
  `compilerOptions.paths` + `baseUrl` (following `extends`, JSONC-aware) become
  the project aliases. Explicit config always wins.
- **Broader asset support** — `wasm` and `txt` join images, fonts, and media as
  hashed-URL imports; the dev MIME map covers all of them (`json` is imported as
  data). Asset imports now behave **identically in dev and build**.
- **Richer build summary** — per-file size with gzip **and brotli**, plus
  totals (file/chunk/asset counts, combined sizes, duration).

### Changed

- The dev server now serves JS-imported assets correctly (asset imports are
  inlined to their dev URL), matching build behaviour.
- `base` is verified across HTML, CSS `url()`, injected stylesheets, and
  JS-imported assets; dynamic-import chunks stay relative (base-agnostic).
- **Tests** expanded to **200+** (library mode, source maps, `define`,
  `emptyOutDir`, cache, tsconfig aliases, assets, `base`, watch), including
  regression coverage.

### Fixed

- JSONC parsing of `tsconfig.json` no longer mistakes `/*` inside a string
  (e.g. the `"@/*"` path key) for a comment.

## [0.7.0] - 2026-06-29

A complete rewrite of the logger and CLI presentation — a modern, polished
terminal experience with its own identity.

### Added

- **Proprietary logger** (`src/logger/`, dependency-free) — terminal capability
  detection (colour level, OSC 8 hyperlinks, CI, TTY, Unicode), cached per
  stream; an ANSI engine with 16/256/**truecolor**/hex and bold/dim/italic/
  underline/strikethrough that **auto-downgrades** to the terminal's level.
- **Smart links** — URLs (incl. localhost/IP) are auto-detected, coloured,
  underlined, and made clickable (OSC 8) with a clean fallback; `logger.link()`
  for manual links.
- **Modern API** — `info`/`success`/`warn`/`error`/`debug` plus `link`/`dim`/
  `color`/`box`/`table`/`separator`/`title`/`print`, with sober Unicode icons.
- **Polished output** — boxed dev/preview start panels (local/network URLs,
  mode, startup time, version), a build summary with per-file and **gzip**
  sizes, and clean, hierarchical error blocks (red title, highlighted message,
  no stack dump).
- **Robust box engine** — a single central width measure (`logger/width.ts`)
  using grapheme segmentation: ANSI/OSC 8 sequences and zero-width characters
  are never counted, while emoji, CJK, and combining marks are sized correctly.
  Every box line is guaranteed the same visual width, with correct titles
  (fixed a top-border off-by-2), padding, alignment (left/center/right), fixed
  or auto width, nesting, and border styles (round/sharp/double/thick/ascii).
- **Levels** — `silent`/`error`/`warn`/`info`/`debug`; build/inspection
  diagnostics moved to `debug` (shown with `--verbose`).

### Changed

- **Removed the `[vantris]` prefix** from every line — the product name now
  appears only in banners, the version, and fatal errors.
- **Tests** expanded to **130** (ANSI engine, capability detection, links,
  formatting). No breaking changes to the public config or behaviour.

## [0.6.0] - 2026-06-29

Internal refactor & quality pass — leaner, easier to maintain ahead of v1. No
breaking changes, no behaviour change.

### Added

- **`vantris/client` types** — ambient declarations for `import.meta.env` and
  asset/CSS module imports. Reference once via `"types": ["vantris/client"]`
  (or a triple-slash directive) — no hand-written `.d.ts` needed.

### Changed

- **Deduplicated path containment** — a single `isWithin(dir, target)` util
  replaces five copies of the `startsWith(dir + sep)` traversal check (dev &
  preview static serving, build HTML/CSS/outDir guards).
- **Logger levels** — `createLogger` now takes a `level`
  (`silent`/`error`/`warn`/`info`/`debug`); `verbose` maps to `debug`. Output is
  filtered by severity, ready for finer-grained logging. Default behaviour is
  unchanged.
- **CSS performance** — `rootDir` is canonicalised (`realpath`) once per
  stylesheet instead of once per `url()`, cutting redundant syscalls.

### Internal

- Audited the tree: no `any`, no plain `throw new Error` (all errors are
  `VantrisError` subclasses), no unused imports/dependencies.
- Tests expanded to **107** — added coverage for `isWithin`, the logger levels,
  the dev import rewriter, the CLI router, and the error hierarchy.

## [0.5.0] - 2026-06-29

Advanced configuration & environment, nearing a stable v1.0.0 core.

### Added

- **Environment variables** — a dedicated `env/` module loads `.env`,
  `.env.local`, `.env.[mode]`, `.env.[mode].local` (later wins) for the active
  mode. Internal API `loadEnv(mode, root)`.
- **`import.meta.env`** — `VANTRIS_`-prefixed variables (plus built-ins `MODE`,
  `DEV`, `PROD`, `BASE_URL`) are statically replaced in dev and build. Secrets
  (unprefixed vars) never reach the bundle.
- **Modes** — `--mode <mode>` on any command; `dev` defaults to `development`,
  `build`/`preview` to `production`. Available as `ctx.mode` at runtime.
- **Aliases** — `resolve.alias` resolved by a single central resolver used by
  dev, build, HTML, and CSS — one implementation, no duplication.
- **Config validation** — invalid configuration fails fast with the property
  path, expected type, and received value (a `ConfigError`/`VantrisError`).
- **Config surface** — the config now accepts a `resolve` section alongside
  `dev`, `build`, and `preview`.
- **Tests** — `.env` loading/priority, modes, exposure/prefixing, the resolver,
  aliases (build + dev), and validation (88 tests total).

### Changed

- `Context` now carries `mode`, `env`, and the central `resolver`.
- `createContext` loads + validates config, loads the mode's env, and wires the
  resolver. No breaking changes to the public config.
- The architecture is positioned for v1.x (plugins/hooks/HMR) via the resolver,
  env, and config layers — without any public plugin API yet.

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

[Unreleased]: https://github.com/vantrisjs/vantris/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/vantrisjs/vantris/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/vantrisjs/vantris/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/vantrisjs/vantris/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/vantrisjs/vantris/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/vantrisjs/vantris/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/vantrisjs/vantris/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/vantrisjs/vantris/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vantrisjs/vantris/releases/tag/v0.1.0
