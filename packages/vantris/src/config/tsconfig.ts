import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

/**
 * Reads alias entries from a project's `tsconfig.json`.
 *
 * Vantris uses this only as a **fallback**: when no `resolve.alias` is set in
 * `vantris.config.*`, the compiler's `compilerOptions.paths` (resolved against
 * `baseUrl`) become the project's aliases, so path mappings work in one place.
 * Explicit Vantris config always wins. Returns an empty object when there is no
 * tsconfig, no `paths`, or the file cannot be parsed.
 *
 * `extends` is followed for relative/absolute parents (a common base-config
 * pattern); bare package `extends` is not resolved.
 */
export async function readTsconfigAliases(
  root: string,
): Promise<Record<string, string>> {
  const loaded = await loadTsconfig(resolve(root, "tsconfig.json"));
  if (!loaded) return {};
  return pathsToAliases(loaded.baseUrlAbs, loaded.paths);
}

interface LoadedTsconfig {
  /** Absolute base directory `paths` targets resolve against. */
  baseUrlAbs: string;
  /** Raw `compilerOptions.paths`. */
  paths: Record<string, string[]>;
}

/** Loads a tsconfig (following `extends`), returning `paths` + absolute baseUrl. */
async function loadTsconfig(
  file: string,
  seen: Set<string> = new Set(),
): Promise<LoadedTsconfig | null> {
  if (seen.has(file)) return null;
  seen.add(file);

  let raw: { compilerOptions?: Record<string, unknown>; extends?: unknown };
  try {
    raw = parseJsonc(await readFile(file, "utf8")) as typeof raw;
  } catch {
    return null;
  }

  const dir = dirname(file);
  const co = raw.compilerOptions ?? {};
  const paths = co.paths as Record<string, string[]> | undefined;

  // `paths` is defined here → resolve against this file's baseUrl (default: its
  // own directory, matching TypeScript 4.1+ where `paths` needs no baseUrl).
  if (paths) {
    const baseUrl = typeof co.baseUrl === "string" ? co.baseUrl : ".";
    return { baseUrlAbs: resolve(dir, baseUrl), paths };
  }

  // Otherwise inherit from the extended config, if any.
  if (typeof raw.extends === "string") {
    const parent = resolveExtends(raw.extends, dir);
    if (parent) return loadTsconfig(parent, seen);
  }
  return null;
}

/** Resolves a relative/absolute `extends` target to a `.json` path. */
function resolveExtends(value: string, dir: string): string | null {
  if (value.startsWith(".") || isAbsolute(value)) {
    const path = resolve(dir, value);
    return path.endsWith(".json") ? path : `${path}.json`;
  }
  return null; // bare-package extends is not resolved (best-effort)
}

/**
 * Converts TypeScript `paths` to Vantris prefix aliases. The trailing `/*`
 * wildcard is stripped from both sides and the first target is used, so
 * `{ "@/*": ["./src/*"] }` becomes `{ "@": "<baseUrl>/src" }`.
 */
function pathsToAliases(
  baseUrlAbs: string,
  paths: Record<string, string[]>,
): Record<string, string> {
  const alias: Record<string, string> = {};
  for (const [key, targets] of Object.entries(paths)) {
    const target = targets?.[0];
    if (!target) continue;
    const find = key.replace(/\/\*$/, "");
    if (!find || find === "*") continue; // skip the catch-all mapping
    alias[find] = resolve(baseUrlAbs, target.replace(/\/\*$/, ""));
  }
  return alias;
}

/**
 * Parses JSON with comments and trailing commas (tsconfig is JSONC).
 *
 * Comment stripping is string-aware: `//` and `/*` sequences inside string
 * literals (e.g. the `"@/*"` path key) are preserved, which a regex strip would
 * wrongly eat.
 */
function parseJsonc(text: string): unknown {
  return JSON.parse(stripTrailingCommas(stripComments(text)));
}

/** Removes `//` and `/* *​/` comments, ignoring comment-like text in strings. */
function stripComments(text: string): string {
  let out = "";
  let inString = false;
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += text[i + 1] ?? "";
        i++;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++; // skip the closing '/'
      continue;
    }
    out += ch;
  }
  return out;
}

/** Removes commas immediately preceding a `}` or `]`. */
function stripTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, "$1");
}
