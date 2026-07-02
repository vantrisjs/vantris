import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { detectCapabilities } from "../src/logger/capabilities.js";

const env = (e: Record<string, string>) => e as NodeJS.ProcessEnv;

describe("detectCapabilities — colour", () => {
  it("disables colour with NO_COLOR", () => {
    expect(detectCapabilities({ isTTY: true }, env({ NO_COLOR: "1" })).colorLevel).toBe(0);
  });

  it("respects FORCE_COLOR", () => {
    expect(detectCapabilities({ isTTY: false }, env({ FORCE_COLOR: "3" })).colorLevel).toBe(3);
    expect(detectCapabilities({ isTTY: true }, env({ FORCE_COLOR: "false" })).colorLevel).toBe(0);
  });

  it("is 0 for a non-TTY outside CI", () => {
    expect(detectCapabilities({ isTTY: false }, env({})).colorLevel).toBe(0);
  });

  it("detects truecolor and 256", () => {
    expect(detectCapabilities({ isTTY: true }, env({ COLORTERM: "truecolor" })).colorLevel).toBe(3);
    expect(detectCapabilities({ isTTY: true }, env({ TERM: "xterm-256color" })).colorLevel).toBe(2);
  });
});

describe("detectCapabilities — other", () => {
  it("detects CI", () => {
    expect(detectCapabilities({ isTTY: false }, env({ CI: "true" })).isCI).toBe(true);
  });

  it("enables hyperlinks only for known TTY terminals", () => {
    expect(detectCapabilities({ isTTY: true }, env({ TERM_PROGRAM: "iTerm.app" })).hyperlinks).toBe(true);
    expect(detectCapabilities({ isTTY: false }, env({ TERM_PROGRAM: "iTerm.app" })).hyperlinks).toBe(false);
    expect(detectCapabilities({ isTTY: true }, env({ TERM: "xterm" })).hyperlinks).toBe(false);
  });

  it("caches per stream", () => {
    const stream = { isTTY: true };
    const a = detectCapabilities(stream, env({ COLORTERM: "truecolor" }));
    const b = detectCapabilities(stream, env({ NO_COLOR: "1" }));
    expect(b).toBe(a); // same cached object, env on 2nd call ignored
  });
});
