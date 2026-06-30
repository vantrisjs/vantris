import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cacheKey, createCache, type Cache } from "../src/cache/index.js";

const dirs: string[] = [];
afterEach(() => Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true }))));

async function tempCache(
  overrides: Partial<{ version: string; fingerprint: string }> = {},
): Promise<{ cache: Cache; dir: string }> {
  const dir = join(await mkdtemp(join(tmpdir(), "vantris-cache-")), ".vantris");
  dirs.push(dir);
  return {
    dir,
    cache: createCache({ dir, version: overrides.version ?? "1.0.0", fingerprint: overrides.fingerprint ?? "fp" }),
  };
}

describe("cache", () => {
  it("returns null on a miss", async () => {
    const { cache } = await tempCache();
    expect(await cache.read("transform/x.js")).toBeNull();
    expect(await cache.readJSON("meta.json")).toBeNull();
  });

  it("round-trips blobs and JSON", async () => {
    const { cache } = await tempCache();
    await cache.write("transform/a.js", "export const a = 1;");
    expect((await cache.read("transform/a.js"))?.toString()).toBe("export const a = 1;");

    await cache.writeJSON("build/last.json", { files: 3 });
    expect(await cache.readJSON("build/last.json")).toEqual({ files: 3 });
  });

  it("writes a manifest stamped with version + fingerprint", async () => {
    const { cache, dir } = await tempCache();
    await cache.write("x", "y");
    const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    expect(manifest).toEqual({ version: "1.0.0", fingerprint: "fp" });
  });

  it("auto-invalidates when the version changes", async () => {
    const { cache, dir } = await tempCache({ version: "1.0.0" });
    await cache.write("transform/a.js", "old");
    expect((await cache.read("transform/a.js"))?.toString()).toBe("old");

    const next = createCache({ dir, version: "2.0.0", fingerprint: "fp" });
    expect(await next.read("transform/a.js")).toBeNull(); // wiped
  });

  it("auto-invalidates when the fingerprint changes", async () => {
    const { cache, dir } = await tempCache({ fingerprint: "a" });
    await cache.write("transform/a.js", "old");
    const next = createCache({ dir, version: "1.0.0", fingerprint: "b" });
    expect(await next.read("transform/a.js")).toBeNull();
  });

  it("preserves entries when version + fingerprint are unchanged", async () => {
    const { cache, dir } = await tempCache();
    await cache.write("transform/a.js", "keep");
    const same = createCache({ dir, version: "1.0.0", fingerprint: "fp" });
    expect((await same.read("transform/a.js"))?.toString()).toBe("keep");
  });

  it("confines keys to the cache directory", async () => {
    const { cache, dir } = await tempCache();
    await cache.write("../escape.js", "x");
    // The traversal segment is stripped — nothing escapes the cache dir.
    expect((await cache.read("escape.js"))?.toString()).toBe("x");
    await expect(readFile(join(dir, "..", "escape.js"), "utf8")).rejects.toThrow();
  });

  it("clear removes everything", async () => {
    const { cache } = await tempCache();
    await cache.write("a", "1");
    await cache.clear();
    expect(await cache.read("a")).toBeNull();
  });
});

describe("cacheKey", () => {
  it("is stable and order-sensitive", () => {
    expect(cacheKey("a", "b")).toBe(cacheKey("a", "b"));
    expect(cacheKey("a", "b")).not.toBe(cacheKey("b", "a"));
    expect(cacheKey("a", undefined)).toBe(cacheKey("a", undefined));
  });
});
