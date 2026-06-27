import type { Config, ConfigInput } from "../types/config.js";

/**
 * Identity helper that gives config authors full type-checking and
 * autocompletion in `vantris.config.ts` / `vantris.config.js`.
 *
 * Accepts either a {@link Config} object or a (possibly async) factory, so the
 * same entry point keeps working as configuration grows more dynamic.
 *
 * @example
 * ```ts
 * import { defineConfig } from "vantris";
 *
 * export default defineConfig({
 *   rootDir: "./src",
 *   outDir: "./dist",
 * });
 * ```
 */
export function defineConfig(config: Config): Config;
export function defineConfig(config: ConfigInput): ConfigInput;
export function defineConfig(config: ConfigInput): ConfigInput {
  return config;
}
