import type { Config } from "../types/config.js";
import type { ResolvedConfig } from "../types/config-resolved.js";
import type { ResolvedPaths } from "../types/paths.js";
import { DEFAULTS } from "../shared/constants.js";
import { resolveFrom } from "../utils/paths.js";

/**
 * Applies defaults to a raw {@link Config} and resolves every directory to an
 * absolute path. This is the single source of truth for default values and
 * path resolution — no other module should re-derive these.
 *
 * @param raw        User configuration (after loading; may be empty).
 * @param cwd        Working directory the invocation started from.
 * @param configFile Absolute path of the loaded config file, or `null`.
 */
export function resolveConfig(
  raw: Config,
  cwd: string,
  configFile: string | null = null,
): ResolvedConfig {
  const root = resolveFrom(cwd, raw.root ?? DEFAULTS.root);

  const paths: ResolvedPaths = {
    root,
    rootDir: resolveFrom(root, raw.rootDir ?? DEFAULTS.rootDir),
    publicDir: resolveFrom(root, raw.publicDir ?? DEFAULTS.publicDir),
    outDir: resolveFrom(root, raw.outDir ?? DEFAULTS.outDir),
  };

  return { raw, paths, configFile };
}
