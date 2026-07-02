import { sep } from "node:path";
import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { isWithin, resolveFrom } from "../src/utils/paths.js";

describe("isWithin", () => {
  const dir = `${sep}a${sep}b`;

  it("matches the directory itself and its descendants", () => {
    expect(isWithin(dir, dir)).toBe(true);
    expect(isWithin(dir, `${dir}${sep}c`)).toBe(true);
    expect(isWithin(dir, `${dir}${sep}c${sep}d.ts`)).toBe(true);
  });

  it("rejects siblings and partial-name prefixes", () => {
    expect(isWithin(dir, `${sep}a${sep}bc`)).toBe(false);
    expect(isWithin(dir, `${sep}a`)).toBe(false);
    expect(isWithin(dir, `${sep}x`)).toBe(false);
  });
});

describe("resolveFrom", () => {
  it("returns absolute targets untouched", () => {
    expect(resolveFrom(`${sep}base`, `${sep}abs`)).toBe(`${sep}abs`);
  });

  it("resolves relative targets against the base", () => {
    expect(resolveFrom(`${sep}base`, "sub")).toBe(`${sep}base${sep}sub`);
  });
});
