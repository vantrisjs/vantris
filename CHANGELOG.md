# Changelog

All notable changes to Vantris are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Reserved for future versions. Planned: dev server (H3), build pipeline
(Rolldown), transforms (esbuild), HMR, and a plugin system._

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

[Unreleased]: https://github.com/vantrisjs/vantris/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vantrisjs/vantris/releases/tag/v0.1.0
