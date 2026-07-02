import { dirname, extname, relative, resolve, sep } from "node:path";
import { ASSET_EXTENSIONS } from "../shared/constants.js";

const ASSET_EXTENSION_SET = new Set<string>(ASSET_EXTENSIONS);

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
 * @example `import React from "react"` → `import React from "/@deps/react.mjs"`
 */
export function rewriteImports(
  code: string,
  aliases: readonly AliasUrl[],
  bareImports?: ReadonlyMap<string, string>,
): string {
  if (aliases.length === 0 && (!bareImports || bareImports.size === 0)) return code;

  return code.replace(IMPORT_RE, (match, pre: string, quote: string, spec: string) => {
    for (const { find, url } of aliases) {
      if (spec === find) return `${pre}${quote}${url}${quote}`;
      if (spec.startsWith(`${find}/`)) {
        return `${pre}${quote}${url}${spec.slice(find.length)}${quote}`;
      }
    }
    const bare = bareImports?.get(spec);
    if (bare) return `${pre}${quote}${bare}${quote}`;
    return match;
  });
}

/** Matches a default asset import: `import name from "./x.png"`. */
const ASSET_IMPORT_RE =
  /\bimport\s+(\w+)\s+from\s*(["'])([^"'`\n]+)\2;?/g;

/**
 * Inlines default asset imports as the dev URL the server serves the file from,
 * so `import logo from "./logo.svg"` works in dev exactly as it does in the
 * build (where it becomes a hashed URL). The browser cannot import an image as
 * a module, so the import is replaced with a string constant.
 *
 * Specifiers are expected to be already alias-resolved (run after
 * {@link rewriteImports}); root-relative URLs are kept, relative paths are
 * resolved against the importer, and bare specifiers are left untouched.
 *
 * @example `import logo from "./logo.svg"` → `const logo = "/src/logo.svg";`
 */
export function inlineAssetImports(
  code: string,
  importerFile: string,
  root: string,
  base = "/",
): string {
  return code.replace(
    ASSET_IMPORT_RE,
    (match, id: string, _quote: string, spec: string) => {
      const clean = spec.split(/[?#]/, 1)[0] ?? spec;
      if (!ASSET_EXTENSION_SET.has(extname(clean).toLowerCase())) return match;

      let url: string;
      if (clean.startsWith("/")) {
        // Already an absolute served URL (e.g. alias-resolved) — re-base it.
        url = `${base}${clean.slice(1)}`;
      } else if (clean.startsWith(".")) {
        const abs = resolve(dirname(importerFile), clean);
        url = `${base}${relative(root, abs).split(sep).join("/")}`;
      } else {
        return match; // bare specifier — not an asset path
      }
      return `const ${id} = ${JSON.stringify(url)};`;
    },
  );
}
