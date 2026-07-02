import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { computeAccept, encodeTextFrame, parseFrames } from "../src/server/websocket.js";
import { corsHeaders, isPreflight } from "../src/server/cors.js";
import { matchProxy, proxyTargetUrl } from "../src/server/proxy.js";
import type { ResolvedCors, ResolvedProxyRule } from "../src/types/config-resolved.js";

/** Builds a masked client→server frame (clients MUST mask). */
function maskedFrame(opcode: number, text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  const mask = Buffer.from([1, 2, 3, 4]);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i]! ^ mask[i & 3]!;
  return Buffer.concat([Buffer.from([0x80 | opcode, 0x80 | payload.length]), mask, masked]);
}

describe("websocket protocol", () => {
  it("computes Sec-WebSocket-Accept (RFC 6455 vector)", () => {
    expect(computeAccept("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
  });

  it("encodes a short text frame (FIN + opcode 0x1, unmasked)", () => {
    const frame = encodeTextFrame("hi");
    expect([...frame]).toEqual([0x81, 0x02, 0x68, 0x69]);
  });

  it("parses and unmasks a client text frame", () => {
    const { frames, rest } = parseFrames(maskedFrame(0x1, "reload"));
    expect(frames).toHaveLength(1);
    expect(frames[0]!.opcode).toBe(0x1);
    expect(frames[0]!.payload.toString()).toBe("reload");
    expect(rest).toHaveLength(0);
  });

  it("distinguishes ping/close opcodes", () => {
    expect(parseFrames(maskedFrame(0x9, "")).frames[0]!.opcode).toBe(0x9);
    expect(parseFrames(maskedFrame(0x8, "")).frames[0]!.opcode).toBe(0x8);
  });

  it("holds back an incomplete frame and resumes when the rest arrives", () => {
    const frame = maskedFrame(0x1, "hello");
    const first = parseFrames(frame.subarray(0, frame.length - 2));
    expect(first.frames).toHaveLength(0);
    expect(first.rest.length).toBe(frame.length - 2);

    const { frames } = parseFrames(Buffer.concat([first.rest, frame.subarray(frame.length - 2)]));
    expect(frames[0]!.payload.toString()).toBe("hello");
  });

  it("parses two frames in one buffer", () => {
    const { frames } = parseFrames(Buffer.concat([maskedFrame(0x1, "a"), maskedFrame(0x1, "b")]));
    expect(frames.map((f) => f.payload.toString())).toEqual(["a", "b"]);
  });
});

const cors = (over: Partial<ResolvedCors> = {}): ResolvedCors => ({
  origin: true,
  methods: ["GET", "POST"],
  headers: [],
  credentials: false,
  ...over,
});

describe("cors", () => {
  it("reflects the origin when origin is true", () => {
    expect(corsHeaders(cors(), "http://a.test")?.["access-control-allow-origin"]).toBe("http://a.test");
  });

  it("allows only listed origins for an array", () => {
    const allow = cors({ origin: ["http://ok.test"] });
    expect(corsHeaders(allow, "http://ok.test")?.["access-control-allow-origin"]).toBe("http://ok.test");
    expect(corsHeaders(allow, "http://no.test")).toBeNull();
  });

  it("emits credentials and methods headers", () => {
    const h = corsHeaders(cors({ credentials: true }), "http://a.test");
    expect(h?.["access-control-allow-credentials"]).toBe("true");
    expect(h?.["access-control-allow-methods"]).toBe("GET, POST");
  });

  it("detects preflight", () => {
    expect(isPreflight("OPTIONS", "GET")).toBe(true);
    expect(isPreflight("OPTIONS", undefined)).toBe(false);
    expect(isPreflight("GET", "GET")).toBe(false);
  });
});

const rule = (over: Partial<ResolvedProxyRule>): ResolvedProxyRule => ({
  context: "/api",
  target: "http://localhost:8080",
  changeOrigin: true,
  secure: true,
  rewrite: null,
  ...over,
});

describe("proxy", () => {
  it("matches the longest context first", () => {
    const rules = [rule({ context: "/api/v2" }), rule({ context: "/api" })].sort(
      (a, b) => b.context.length - a.context.length,
    );
    expect(matchProxy(rules, "/api/v2/users")?.context).toBe("/api/v2");
    expect(matchProxy(rules, "/api/users")?.context).toBe("/api");
    expect(matchProxy(rules, "/other")).toBeNull();
  });

  it("builds the target URL, applying a rewrite and preserving the query", () => {
    expect(proxyTargetUrl(rule({}), "/api/users", "?q=1")).toBe("http://localhost:8080/api/users?q=1");
    const stripped = rule({ rewrite: (p) => p.replace(/^\/api/, "") });
    expect(proxyTargetUrl(stripped, "/api/users", "")).toBe("http://localhost:8080/users");
  });
});
