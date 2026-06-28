import { createHash } from "node:crypto";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { isDirectory } from "../utils/fs.js";
import { BuildError } from "../shared/errors.js";

/** A short, content-derived hash (matches the bundler's `[hash]` style). */
export function contentHash(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("base64url").slice(0, 8);
}

/**
 * Writes `content` to `${outDir}/${assetsDir}/${name}-${hash}${ext}`, deriving
 * the name and extension from `sourceName`.
 *
 * @returns The emitted file name relative to `outDir` (e.g. `assets/logo-AbC1.svg`).
 */
export async function emitHashedAsset(
  outDir: string,
  assetsDir: string,
  sourceName: string,
  content: string | Uint8Array,
): Promise<string> {
  const ext = extname(sourceName);
  const name = basename(sourceName, ext) || "asset";
  const fileName = `${assetsDir}/${name}-${contentHash(content)}${ext}`;
  const target = join(outDir, fileName);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  return fileName;
}

/**
 * Copies the public directory verbatim into the output directory.
 *
 * Files under `publicDir` are emitted as-is, with no transformation — exactly
 * Vite's `public/` semantics. This is the seam where richer asset handling
 * (hashing, manifests) can later hook in without changing callers.
 *
 * @returns `true` when a public directory existed and was copied.
 * @throws {BuildError} when copying fails.
 */
export async function copyPublicDir(
  publicDir: string,
  outDir: string,
): Promise<boolean> {
  if (!(await isDirectory(publicDir))) return false;

  try {
    await cp(publicDir, outDir, { recursive: true });
    return true;
  } catch (cause) {
    throw new BuildError(
      `Failed to copy public assets from ${publicDir}: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause },
    );
  }
}
