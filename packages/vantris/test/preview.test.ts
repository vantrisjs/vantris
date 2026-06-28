import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewConfig } from "../src/types/config.js";
import {
  startPreviewServer,
  type PreviewServerHandle,
} from "../src/preview/index.js";
import { PreviewError, ServerError } from "../src/shared/errors.js";
import { cleanupProjects, makeContext, makeProject } from "./helpers.js";

const handles: PreviewServerHandle[] = [];

afterEach(async () => {
  await Promise.all(handles.splice(0).map((h) => h.close()));
  await cleanupProjects();
});

const DIST = {
  "dist/index.html":
    `<!doctype html><html><body><div id="app"></div></body></html>`,
  "dist/assets/app.js": `console.log("built");`,
};

async function startPreview(
  files: Record<string, string>,
  preview: PreviewConfig = {},
  open?: (url: string) => void,
) {
  const dir = await makeProject(files);
  const { ctx } = makeContext(dir, {
    preview: { port: 0, host: "127.0.0.1", ...preview },
  });
  const handle = await startPreviewServer({ ctx, ...(open ? { open } : {}) });
  handles.push(handle);
  return { dir, handle };
}

describe("preview server", () => {
  it("serves build output with the right content types", async () => {
    const { handle } = await startPreview(DIST);

    const root = await fetch(handle.url);
    expect(root.status).toBe(200);
    expect(root.headers.get("content-type")).toContain("text/html");
    expect(await root.text()).toContain('id="app"');

    const js = await fetch(new URL("/assets/app.js", handle.url));
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toContain("javascript");
  });

  it("falls back to index.html for client routes, 404s missing assets", async () => {
    const { handle } = await startPreview(DIST);

    const spa = await fetch(new URL("/dashboard/settings", handle.url));
    expect(spa.status).toBe(200);
    expect(await spa.text()).toContain('id="app"');

    const missing = await fetch(new URL("/nope.js", handle.url));
    expect(missing.status).toBe(404);
  });

  it("reports a startup time and serves from outDir", async () => {
    const { dir, handle } = await startPreview(DIST);
    expect(handle.startupMs).toBeGreaterThanOrEqual(0);
    expect(handle.root).toBe(`${dir}/dist`);
  });

  it("serves base-prefixed URLs when base is set", async () => {
    const dir = await makeProject({
      "dist/index.html":
        `<!doctype html><html><body><div id="app"></div>` +
        `<script type="module" src="/app/assets/app.js"></script></body></html>`,
      "dist/assets/app.js": `console.log("built");`,
    });
    const { ctx } = makeContext(dir, {
      base: "/app/",
      preview: { port: 0, host: "127.0.0.1" },
    });
    const handle = await startPreviewServer({ ctx });
    handles.push(handle);

    const js = await fetch(new URL("/app/assets/app.js", handle.url));
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toContain("javascript");

    // The root still serves the (base-prefixed) index.
    const root = await fetch(handle.url);
    expect(await root.text()).toContain("/app/assets/app.js");
  });

  it("omits the network URL when bound to a loopback host", async () => {
    const { handle } = await startPreview(DIST); // host 127.0.0.1
    expect(handle.networkUrl).toBeNull();
  });

  describe("auto-open", () => {
    it("opens the browser when preview.open is true", async () => {
      const open = vi.fn();
      const { handle } = await startPreview(DIST, { open: true }, open);
      expect(open).toHaveBeenCalledWith(handle.url);
    });

    it("does not open the browser when preview.open is false", async () => {
      const open = vi.fn();
      await startPreview(DIST, { open: false }, open);
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe("errors", () => {
    it("throws PreviewError when the build output is missing", async () => {
      await expect(startPreview({ "src/main.ts": "1;" })).rejects.toBeInstanceOf(
        PreviewError,
      );
    });

    it("throws ServerError when the port is already in use", async () => {
      const { handle } = await startPreview(DIST);
      await expect(
        startPreview(DIST, { port: handle.port }),
      ).rejects.toBeInstanceOf(ServerError);
    });
  });
});
