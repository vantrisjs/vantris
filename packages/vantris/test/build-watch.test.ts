import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { watchBuild } from "../src/build/watch.js";
import { cleanupProjects, makeContext, makeProject, waitFor } from "./utils/helpers.js";

afterEach(cleanupProjects);

/** Touches `file` until `done()` is true (robust against watcher startup lag). */
async function touchUntil(file: string, done: () => boolean): Promise<void> {
  const start = Date.now();
  while (!done() && Date.now() - start < 8000) {
    await writeFile(file, `export const n = ${Date.now()};`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

describe("watchBuild", () => {
  it("builds once up front, rebuilds on change, and stops on shutdown", async () => {
    const dir = await makeProject({ "src/a.ts": "export const n = 1;" });
    const { ctx } = makeContext(dir);

    let builds = 0;
    let release!: () => void;
    const shutdown = new Promise<void>((resolve) => (release = resolve));

    const run = watchBuild(ctx, [join(dir, "src")], async () => void builds++, () => shutdown);

    await waitFor(() => builds >= 1); // initial build
    await touchUntil(join(dir, "src/a.ts"), () => builds >= 2); // rebuild on change

    release();
    await run;
    expect(builds).toBeGreaterThanOrEqual(2);
  });

  it("keeps watching after a failing build", async () => {
    const dir = await makeProject({ "src/a.ts": "export const n = 1;" });
    const { ctx, logger } = makeContext(dir);

    let builds = 0;
    let release!: () => void;
    const shutdown = new Promise<void>((resolve) => (release = resolve));

    const run = watchBuild(
      ctx,
      [join(dir, "src")],
      async () => {
        builds++;
        if (builds === 1) throw new Error("boom");
      },
      () => shutdown,
    );

    await waitFor(() => builds >= 1);
    expect(logger.messages.some((m) => m.includes("boom"))).toBe(true);

    await touchUntil(join(dir, "src/a.ts"), () => builds >= 2); // watcher survived the error
    expect(builds).toBeGreaterThanOrEqual(2);

    release();
    await run;
  });
});
