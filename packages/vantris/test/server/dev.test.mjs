// Dev-server integration tests, written with `node:test` so they run under
// both Node.js (`node --test`) and Bun (`bun test`). They exercise the public
// `createDevServer()` only, guaranteeing identical observable behaviour across
// runtimes.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  createContext,
  createDevServer,
  createLogger,
  detectHtmlEntry,
} from "../../src/index.js";

const HTML =
  `<!doctype html><html><head></head><body><div id="app"></div>` +
  `<script type="module" src="/src/main.ts"></script></body></html>`;

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const cleanups = [];
after(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startServer(files, configText) {
  const dir = await mkdtemp(join(tmpdir(), "vantris-srv-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  for (const [rel, content] of Object.entries(files)) {
    const file = join(dir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  if (configText) await writeFile(join(dir, "vantris.config.mjs"), configText);

  const ctx = await createContext({ cwd: dir, logger: createLogger({ level: "silent" }) });
  const entry = await detectHtmlEntry(ctx.config.paths.root);
  const server = await createDevServer({ ctx, entry, port: 0, host: "127.0.0.1" });
  cleanups.push(() => server.close());
  return server;
}

const BASIC = { "index.html": HTML, "src/main.ts": "export {};" };

test("serves index.html with the injected reload client", async () => {
  const server = await startServer({ "index.html": HTML, "src/main.ts": "console.log(1);" });
  const res = await fetch(server.url);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Injected by Vantris/);
  assert.match(body, /id="app"/);
});

test("transpiles TypeScript on the fly", async () => {
  const server = await startServer({ "index.html": HTML, "src/main.ts": "export const x: number = 1;" });
  const res = await fetch(new URL("/src/main.ts", server.url));
  assert.match(res.headers.get("content-type") ?? "", /javascript/);
  assert.doesNotMatch(await res.text(), /: number/);
});

test("serves public assets and never exposes hidden files", async () => {
  const server = await startServer({ ...BASIC, "public/robots.txt": "ok", "secret.txt": "TOPSECRET" });
  assert.equal(await (await fetch(new URL("/robots.txt", server.url))).text(), "ok");
  const secret = await fetch(new URL("/secret.txt", server.url));
  assert.equal(secret.status, 404);
  assert.doesNotMatch(await secret.text(), /TOPSECRET/);
});

test("SPA fallback serves index.html for routes, and can be disabled", async () => {
  const on = await startServer(BASIC, "export default { server: { spaFallback: true } };");
  const route = await fetch(new URL("/some/route", on.url));
  assert.equal(route.status, 200);
  assert.match(await route.text(), /id="app"/);

  const off = await startServer(BASIC, "export default { server: { spaFallback: false } };");
  assert.equal((await fetch(new URL("/some/route", off.url))).status, 404);
});

test("serves the app under a base sub-path", async () => {
  const server = await startServer(BASIC, 'export default { base: "/app/" };');
  assert.match(server.url, /\/app\/$/);
  assert.match(await (await fetch(server.url)).text(), /id="app"/);
});

test("applies CORS headers and answers preflight when enabled", async () => {
  const server = await startServer(BASIC, "export default { server: { cors: true } };");
  const res = await fetch(server.url, { headers: { origin: "http://x.test" } });
  assert.equal(res.headers.get("access-control-allow-origin"), "http://x.test");

  const preflight = await fetch(new URL("/src/main.ts", server.url), {
    method: "OPTIONS",
    headers: { origin: "http://x.test", "access-control-request-method": "GET" },
  });
  assert.equal(preflight.status, 204);
});

test("proxies matched requests to the target", async () => {
  const target = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`from-target:${req.url}`);
  });
  await new Promise((resolve) => target.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => new Promise((resolve) => target.close(resolve)));
  const targetPort = target.address().port;

  const server = await startServer(
    BASIC,
    `export default { server: { proxy: { "/api": "http://127.0.0.1:${targetPort}" } } };`,
  );
  const res = await fetch(new URL("/api/hello", server.url));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "from-target:/api/hello");
});

test("reports an unreachable proxy target as 502", async () => {
  const server = await startServer(BASIC, 'export default { server: { proxy: { "/api": "http://127.0.0.1:1" } } };');
  assert.equal((await fetch(new URL("/api/x", server.url))).status, 502);
});

test("serves HTTPS with a generated self-signed certificate", async () => {
  const server = await startServer(BASIC, "export default { server: { https: true } };");
  assert.equal(server.https, true);
  assert.match(server.url, /^https:/);

  const body = await new Promise((resolve, reject) => {
    const req = httpsRequest(server.url, { rejectUnauthorized: false }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.end();
  });
  assert.match(body, /id="app"/);
});

test("WebSocket: handshake, reload broadcast, and ping/pong", async () => {
  const server = await startServer(BASIC);
  const socket = connect(server.port, "127.0.0.1");
  cleanups.push(() => socket.destroy());
  const key = randomBytes(16).toString("base64");

  await new Promise((resolve) => socket.once("connect", resolve));
  socket.write(
    `GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
  );

  const messages = [];
  let buffer = Buffer.alloc(0);
  let handshaken = false;

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), 5000);
    const pinger = setInterval(() => server.broadcastReload(), 50);

    const finish = () => {
      clearTimeout(timer);
      clearInterval(pinger);
      resolve(messages);
    };

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (!handshaken) {
        const end = buffer.indexOf("\r\n\r\n");
        if (end === -1) return;
        const header = buffer.subarray(0, end).toString();
        assert.match(header, /101 Switching Protocols/);
        const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
        assert.ok(header.includes(`Sec-WebSocket-Accept: ${accept}`));
        handshaken = true;
        buffer = buffer.subarray(end + 4);
        socket.write(clientPing()); // masked, zero-length ping
      }

      // Parse unmasked server frames (all short: length < 126).
      let offset = 0;
      while (offset + 2 <= buffer.length) {
        const opcode = buffer[offset] & 0x0f;
        const length = buffer[offset + 1] & 0x7f;
        if (offset + 2 + length > buffer.length) break;
        messages.push({ opcode, text: buffer.subarray(offset + 2, offset + 2 + length).toString() });
        offset += 2 + length;
      }
      buffer = buffer.subarray(offset);

      if (messages.some((m) => m.opcode === 0x1 && m.text === "reload") && messages.some((m) => m.opcode === 0xa)) {
        finish();
      }
    });
    socket.on("error", reject);
  });

  assert.ok(result.some((m) => m.opcode === 0x1 && m.text === "reload"), "received reload text frame");
  assert.ok(result.some((m) => m.opcode === 0xa), "received pong");
});

/** A masked, zero-length client ping frame. */
function clientPing() {
  return Buffer.concat([Buffer.from([0x89, 0x80]), Buffer.from([1, 2, 3, 4])]);
}
