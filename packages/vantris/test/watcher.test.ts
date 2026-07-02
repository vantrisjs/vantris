import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { createWatcher, type WatchEvent } from "../src/shared/watcher.js";
import { cleanupProjects, makeProject, silentLogger, waitFor } from "./utils/helpers.js";

afterEach(cleanupProjects);

describe("createWatcher", () => {
  it("reports changes to files in the watched directory", async () => {
    const dir = await makeProject({ "src/main.ts": "1;" });
    const events: WatchEvent[] = [];

    const watcher = createWatcher({
      dir: join(dir, "src"),
      logger: silentLogger(),
      onChange: (event) => events.push(event),
    });

    try {
      // Let the watcher seed its set of known files before mutating.
      await new Promise((r) => setTimeout(r, 400));
      await writeFile(join(dir, "src/main.ts"), "2;");
      await waitFor(() => events.length > 0, 5000);
    } finally {
      await watcher.close();
    }

    expect(events.some((e) => e.kind === "change")).toBe(true);
    expect(events[0]?.file).toContain("main.ts");
  });
});
