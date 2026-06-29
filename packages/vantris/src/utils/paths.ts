import { isAbsolute, resolve, sep } from "node:path";

/**
 * Resolves `target` against `base`, returning an absolute path.
 * Absolute targets are returned untouched.
 */
export function resolveFrom(base: string, target: string): string {
  return isAbsolute(target) ? target : resolve(base, target);
}

/**
 * Whether `target` is `dir` itself or lives inside it. The single source of
 * truth for path containment / traversal checks across the codebase.
 */
export function isWithin(dir: string, target: string): boolean {
  return target === dir || target.startsWith(dir + sep);
}
