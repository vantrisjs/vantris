import { describe, expect, it } from "vitest";
import { box, type BorderStyle } from "../src/logger/format.js";
import { displayWidth } from "../src/logger/width.js";
import { createTheme } from "../src/logger/theme.js";

const plain = createTheme(0);
const colored = createTheme(3);
const opt = (extra: Record<string, unknown> = {}) => ({
  theme: plain,
  unicode: true,
  ...extra,
});

/** Visible widths of every line of a rendered box. */
const lineWidths = (rendered: string): number[] =>
  rendered.split("\n").map(displayWidth);

/** Asserts every line of the box shares one visible width. */
const isUniform = (rendered: string): boolean =>
  new Set(lineWidths(rendered)).size === 1;

describe("box — uniform width across content", () => {
  it("empty content", () => {
    expect(isUniform(box([], opt()))).toBe(true);
    expect(isUniform(box([""], opt()))).toBe(true);
  });

  it("single and multi-line content", () => {
    expect(isUniform(box(["a"], opt()))).toBe(true);
    expect(isUniform(box(["a", "bbbb", "cc"], opt()))).toBe(true);
  });

  it("very long content", () => {
    expect(isUniform(box(["x".repeat(200), "y"], opt()))).toBe(true);
  });

  it("ANSI-coloured content (codes never counted)", () => {
    const out = box([colored.error("danger"), colored.info("info")], {
      theme: colored,
      unicode: true,
    });
    expect(isUniform(out)).toBe(true);
  });

  it("OSC 8 hyperlinks (never counted)", () => {
    const link = "\x1b]8;;https://x.com\x07click here\x1b]8;;\x07";
    expect(isUniform(box([link, "plain"], opt()))).toBe(true);
  });

  it("emoji content", () => {
    expect(isUniform(box(["🚀 launch now", "ok"], opt()))).toBe(true);
    expect(isUniform(box(["👨‍👩‍👧 family", "x"], opt()))).toBe(true);
  });

  it("CJK (full-width) content", () => {
    expect(isUniform(box(["中文字符测试", "abc"], opt()))).toBe(true);
  });

  it("combining marks", () => {
    expect(isUniform(box(["é́ café", "short"], opt()))).toBe(true);
  });
});

describe("box — titles", () => {
  it("title shorter than content", () => {
    expect(isUniform(box(["some longer content"], opt({ title: "Hi" })))).toBe(true);
  });

  it("title longer than content (box expands, title intact)", () => {
    const out = box(["x"], opt({ title: "A Very Long Title Indeed" }));
    expect(isUniform(out)).toBe(true);
    expect(out).toContain("A Very Long Title Indeed");
  });

  it("ANSI-styled title", () => {
    const out = box(["content"], {
      theme: colored,
      unicode: true,
      title: colored.brand("Styled"),
    });
    expect(isUniform(out)).toBe(true);
  });

  it("emoji / Unicode title", () => {
    expect(isUniform(box(["content"], opt({ title: "🚀 Vantris" })))).toBe(true);
    expect(isUniform(box(["content"], opt({ title: "标题" })))).toBe(true);
  });

  it("empty title behaves like no title", () => {
    expect(isUniform(box(["content"], opt({ title: "" })))).toBe(true);
  });

  it("regression: titled top border equals the bottom (was off by 2)", () => {
    const lines = box(["short"], opt({ title: "T" })).split("\n");
    expect(displayWidth(lines[0]!)).toBe(displayWidth(lines.at(-1)!));
  });
});

describe("box — padding & alignment", () => {
  it("respects padding (no content touches the border)", () => {
    for (const padding of [0, 1, 2, 4]) {
      const out = box(["abc"], opt({ padding }));
      expect(isUniform(out)).toBe(true);
    }
  });

  it("aligns left, center, and right uniformly", () => {
    for (const align of ["left", "center", "right"] as const) {
      expect(isUniform(box(["x", "wider line"], opt({ align })))).toBe(true);
    }
  });

  it("centers a short line within the available width", () => {
    const lines = box(["x", "123456"], opt({ align: "center", padding: 0 })).split("\n");
    // the short row gets leading and trailing fill around "x"
    expect(lines.some((l) => /\s+x\s+/.test(l))).toBe(true);
  });

  it("vertical padding adds uniform blank rows top and bottom", () => {
    const out = box(["one", "two"], opt({ padding: { x: 2, y: 1 } }));
    const lines = out.split("\n");
    // top + 1 blank + 2 content + 1 blank + bottom = 6 lines
    expect(lines).toHaveLength(6);
    expect(isUniform(out)).toBe(true);
    // the blank rows carry no text, only borders + spaces
    expect(lines[1]!.trim()).toMatch(/^[│|]\s*[│|]$/);
    expect(lines.at(-2)!.trim()).toMatch(/^[│|]\s*[│|]$/);
  });

  it("a single number pads all four sides", () => {
    const out = box(["x"], opt({ padding: 2 }));
    // 2 blank rows top + 1 content + 2 blank bottom + 2 borders = 7 lines
    expect(out.split("\n")).toHaveLength(7);
    expect(isUniform(out)).toBe(true);
  });
});

describe("box — widths", () => {
  it("auto width fits the widest line", () => {
    const top = box(["hello"], opt({ padding: 0 })).split("\n")[0]!;
    expect(displayWidth(top)).toBe(7); // 5 + 2 borders
  });

  it("fixed minimum width expands the box", () => {
    const top = box(["x"], opt({ width: 20, padding: 0 })).split("\n")[0]!;
    expect(displayWidth(top)).toBe(22); // 20 + 2 borders
  });
});

describe("box — border styles", () => {
  it("every style renders uniformly", () => {
    const styles: BorderStyle[] = ["round", "sharp", "double", "thick", "ascii"];
    for (const border of styles) {
      expect(isUniform(box(["content", "x"], opt({ border })))).toBe(true);
    }
  });
});

describe("box — nested", () => {
  it("a box inside a box stays aligned", () => {
    const inner = box(["inner content", "x"], opt({ title: "Inner" }));
    const outer = box(inner.split("\n"), opt({ title: "Outer" }));
    expect(isUniform(outer)).toBe(true);
  });
});
