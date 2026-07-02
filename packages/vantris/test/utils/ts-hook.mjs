import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Module resolve hook: remaps relative `.js` specifiers to their `.ts` source.
 *
 * The codebase uses NodeNext `.js` import specifiers that point at `.ts` files.
 * Paired with `--experimental-transform-types`, this lets `node --test` run the
 * TypeScript suite directly against `src/` — no test-runner dependency.
 */
export async function resolve(specifier, context, next) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    specifier.endsWith(".js") &&
    context.parentURL
  ) {
    const candidate = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) {
      return next(`${specifier.slice(0, -3)}.ts`, context);
    }
  }
  return next(specifier, context);
}
