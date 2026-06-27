/**
 * Fully resolved, absolute filesystem paths derived from a {@link Config}.
 *
 * Commands and subsystems should depend on this resolved shape rather than on
 * the raw user config, so that path resolution lives in exactly one place.
 */
export interface ResolvedPaths {
  /** Absolute project root. */
  root: string;
  /** Absolute source directory. */
  rootDir: string;
  /** Absolute public/static directory. */
  publicDir: string;
  /** Absolute build output directory. */
  outDir: string;
}
