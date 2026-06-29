import { describe, expect, it } from "vitest";
import { createPainter, hexToRgb, rgbToAnsi256 } from "../src/logger/ansi.js";

describe("ansi colour", () => {
  it("parses hex (#rrggbb and #rgb)", () => {
    expect(hexToRgb("#ff8800")).toEqual([255, 136, 0]);
    expect(hexToRgb("#f80")).toEqual([255, 136, 0]);
  });

  it("maps RGB to a 256 index (grayscale + colour)", () => {
    expect(rgbToAnsi256([0, 0, 0])).toBe(16);
    expect(rgbToAnsi256([255, 255, 255])).toBe(231);
    expect(rgbToAnsi256([255, 0, 0])).toBeGreaterThan(16);
  });

  it("level 0 returns text unchanged (no codes)", () => {
    const p = createPainter(0);
    expect(p.bold("x")).toBe("x");
    expect(p.fg([255, 0, 0])("x")).toBe("x");
  });

  it("truecolor emits 38;2;r;g;b", () => {
    expect(createPainter(3).fg([255, 0, 0])("x")).toContain("38;2;255;0;0");
  });

  it("256 emits 38;5;<idx>", () => {
    expect(createPainter(2).fg([255, 0, 0])("x")).toContain("38;5;");
  });

  it("16 downgrades to a basic SGR code", () => {
    const out = createPainter(1).fg([255, 0, 0])("x");
    expect(out).not.toContain("38;5");
    expect(out).not.toContain("38;2");
    expect(out).toMatch(/\x1b\[\d+m/);
  });

  it("styles wrap with open/close codes", () => {
    expect(createPainter(1).bold("x")).toBe("\x1b[1mx\x1b[22m");
    expect(createPainter(1).underline("x")).toBe("\x1b[4mx\x1b[24m");
  });
});
