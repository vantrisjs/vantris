/** An alias mapped to the dev URL it should resolve to (e.g. `@` → `/src`). */
export interface AliasUrl {
  find: string;
  url: string;
}

/** Matches the specifier string of `from "…"`, `import "…"`, `import("…")`. */
const IMPORT_RE =
  /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'`])([^"'`\n]+)\2/g;

/**
 * Rewrites aliased import specifiers in transpiled dev code to the URL the dev
 * server serves them from (the browser can't resolve bare aliases). Uses the
 * same alias semantics as the central resolver — no separate logic.
 *
 * @example `import x from "@/a"` → `import x from "/src/a"`
 */
export function rewriteImports(
  code: string,
  aliases: readonly AliasUrl[],
): string {
  if (aliases.length === 0) return code;

  return code.replace(IMPORT_RE, (match, pre: string, quote: string, spec: string) => {
    for (const { find, url } of aliases) {
      if (spec === find) return `${pre}${quote}${url}${quote}`;
      if (spec.startsWith(`${find}/`)) {
        return `${pre}${quote}${url}${spec.slice(find.length)}${quote}`;
      }
    }
    return match;
  });
}
