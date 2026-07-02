import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { rewriteImports } from "../src/server/rewrite.js";

const aliases = [
  { find: "@", url: "/src" },
  { find: "~", url: "/shared" },
];

describe("rewriteImports", () => {
  it("rewrites from / import / dynamic-import specifiers", () => {
    expect(rewriteImports(`import x from "@/a";`, aliases)).toContain('"/src/a"');
    expect(rewriteImports(`export { y } from '@/b';`, aliases)).toContain("'/src/b'");
    expect(rewriteImports(`const m = import("@/c");`, aliases)).toContain('"/src/c"');
    expect(rewriteImports(`import "~/d.css";`, aliases)).toContain('"/shared/d.css"');
  });

  it("leaves relative and bare specifiers untouched", () => {
    const code = `import a from "./rel"; import b from "react";`;
    expect(rewriteImports(code, aliases)).toBe(code);
  });

  it("does not touch import.meta", () => {
    const code = `console.log(import.meta.url, import.meta.env.MODE);`;
    expect(rewriteImports(code, aliases)).toBe(code);
  });

  it("is a no-op when there are no aliases", () => {
    const code = `import x from "@/a";`;
    expect(rewriteImports(code, [])).toBe(code);
  });
});
