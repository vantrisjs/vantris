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
| `build/`    | Build seam (planned: Rolldown + esbuild).               |
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
  dev: {
    port: 3000,          // default
    host: "localhost",   // default
  },
});
```

All fields are optional; the defaults above apply when omitted.

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
reachable. HMR, plugins, and the production build are intentionally **not** part
of this version.
