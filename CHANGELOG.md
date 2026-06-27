# Changelog

All notable changes to Vantris are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Reserved for future versions. Planned: build pipeline (Rolldown), HMR, and a
plugin system._

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

[Unreleased]: https://github.com/vantrisjs/vantris/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/vantrisjs/vantris/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vantrisjs/vantris/releases/tag/v0.1.0
