import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { autolink, hyperlink, renderLink } from "../src/logger/links.js";
import { createTheme } from "../src/logger/theme.js";

const theme = createTheme(0); // no colour → simpler assertions

describe("links", () => {
  it("wraps text in an OSC 8 hyperlink", () => {
    const out = hyperlink("text", "https://x.com");
    expect(out).toContain("\x1b]8;;https://x.com");
    expect(out).toContain("text");
  });

  it("falls back to 'label (url)' without OSC 8", () => {
    expect(renderLink("Docs", "https://x.com", theme, false)).toBe(
      "Docs (https://x.com)",
    );
  });

  it("shows only the clickable label with OSC 8", () => {
    const out = renderLink("Docs", "https://x.com", theme, true);
    expect(out).toContain("\x1b]8;;https://x.com");
    expect(out).not.toContain("(https://x.com)");
  });

  it("auto-detects http and localhost URLs", () => {
    expect(autolink("at http://localhost:3000/ now", theme, false)).toContain(
      "http://localhost:3000/",
    );
    expect(autolink("ip 127.0.0.1:4173 ok", theme, true)).toContain(
      "\x1b]8;;http://127.0.0.1:4173",
    );
  });

  it("leaves prose untouched", () => {
    expect(autolink("just words here", theme, false)).toBe("just words here");
    expect(autolink("the localhost machine", theme, false)).toBe(
      "the localhost machine",
    );
  });
});
