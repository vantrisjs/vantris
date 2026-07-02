import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { box, formatBytes, stripAnsi, table, visibleWidth } from "../src/logger/format.js";
import { createTheme } from "../src/logger/theme.js";

const theme = createTheme(0);

describe("format helpers", () => {
  it("strips ANSI and OSC 8 for width", () => {
    expect(stripAnsi("\x1b[1mhi\x1b[22m")).toBe("hi");
    expect(stripAnsi("\x1b]8;;https://x\x07link\x1b]8;;\x07")).toBe("link");
    expect(visibleWidth("\x1b[31mabc\x1b[39m")).toBe(3);
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.50 kB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
  });

  it("draws an aligned box", () => {
    const lines = box(["abc", "de"], { theme, unicode: true }).split("\n");
    expect(lines[0]).toContain("╭");
    expect(lines[0]).toContain("╮");
    expect(lines.at(-1)).toContain("╰");
    // body rows share one visible width
    const widths = lines.slice(1, -1).map(visibleWidth);
    expect(new Set(widths).size).toBe(1);
  });

  it("aligns table label columns", () => {
    const out = table(
      [
        ["Local", "x"],
        ["Network", "y"],
      ],
      theme,
    );
    const [row1, row2] = out.split("\n");
    expect(row1).toContain("Local");
    expect(row2).toContain("Network");
  });
});
