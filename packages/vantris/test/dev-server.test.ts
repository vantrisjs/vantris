import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { Config } from "../src/types/config.js";
import { startDevServer, type DevServerHandle } from "../src/server/index.js";
import { detectHtmlEntry } from "../src/html/index.js";
import { cleanupProjects, makeContext, makeProject } from "./helpers.js";

const handles: DevServerHandle[] = [];

afterEach(async () => {
  await Promise.all(handles.splice(0).map((h) => h.close()));
  await cleanupProjects();
});

const HTML =
  `<!doctype html><html><head></head><body><div id="app"></div>` +
  `<script type="module" src="/src/main.ts"></script></body></html>`;

async function startServer(files: Record<string, string>, config: Config = {}) {
  const dir = await makeProject(files);
  const { ctx } = makeContext(dir, {
    ...config,
    dev: { port: 0, host: "127.0.0.1" },
  });
  const entry = await detectHtmlEntry(ctx.config.paths.root);
  const handle = await startDevServer({ ctx, entry });
  handles.push(handle);
  return { dir, handle };
}

describe("dev server", () => {
  it("serves index.html with the injected reload client", async () => {
    const { handle } = await startServer({
      "index.html": HTML,
      "src/main.ts": `console.log(1);`,
    });
    const res = await fetch(handle.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Injected by Vantris");
    expect(body).toContain('id="app"');
  });

  it("transpiles TypeScript modules on the fly", async () => {
    const { handle } = await startServer({
      "index.html": HTML,
      "src/main.ts": `export const x: number = 1;`,
    });
    const res = await fetch(new URL("/src/main.ts", handle.url));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).not.toContain(": number");
  });

  it("serves public assets at the root", async () => {
    const { handle } = await startServer({
      "index.html": HTML,
      "src/main.ts": `export {};`,
      "public/robots.txt": "ok",
    });
    const res = await fetch(new URL("/robots.txt", handle.url));
    expect(await res.text()).toBe("ok");
  });

  it("never exposes files outside src/public (falls back to index.html)", async () => {
    const { handle } = await startServer({
      "index.html": HTML,
      "src/main.ts": `export {};`,
      "secret.txt": "TOPSECRET",
    });
    const res = await fetch(new URL("/secret.txt", handle.url));
    const body = await res.text();
    expect(body).not.toContain("TOPSECRET");
    expect(body).toContain("Injected by Vantris");
  });

  it("pushes a reload over the WebSocket on broadcastReload()", async () => {
    const { handle } = await startServer({
      "index.html": HTML,
      "src/main.ts": `export {};`,
    });
    const ws = new WebSocket(handle.url.replace("http://", "ws://"));

    const message = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no reload received")), 4000);
      let pinger: NodeJS.Timeout | undefined;
      ws.on("open", () => {
        // Broadcast repeatedly until the client receives it (avoids a race
        // with the server registering the connection).
        pinger = setInterval(() => handle.broadcastReload(), 50);
      });
      ws.on("message", (data) => {
        clearTimeout(timer);
        if (pinger) clearInterval(pinger);
        resolve(data.toString());
      });
      ws.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    ws.close();
    expect(message).toBe("reload");
  });
});
