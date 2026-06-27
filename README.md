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
| `html/`     | Isolated HTML entry detection & parsing.                |
| `server/`   | Dev server seam (planned: H3 + HMR).                    |
| `build/`    | Build seam (planned: Rolldown + esbuild).               |
| `preview/`  | Preview seam (planned: static server over `outDir`).    |
| `shared/`   | Context factory, logger, errors, constants.             |
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
  rootDir: "./src",     // default
  publicDir: "./public", // default
  outDir: "./dist",      // default
});
```

All fields are optional; the defaults above apply when omitted.
