import { isAbsolute, resolve } from "node:path";

/**
 * Resolves `target` against `base`, returning an absolute path.
 * Absolute targets are returned untouched.
 */
export function resolveFrom(base: string, target: string): string {
  return isAbsolute(target) ? target : resolve(base, target);
}
