import { defineConfig } from "tsup";

export default defineConfig({
  // Two entry points: the programmatic API and the CLI binary. tsup preserves
  // the directory layout, so they emit to dist/index.js and dist/cli/index.js,
  // matching package.json `exports` and `bin`.
  entry: ["src/index.ts", "src/cli/index.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  platform: "node",

  // Emit .d.ts declarations alongside the JS.
  dts: true,
  // Share code between the two entries instead of duplicating it.
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,

  // The shebang in src/cli/index.ts is preserved and the output is made
  // executable automatically by tsup.
});
