import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { inlineAssetImports, rewriteImports } from "../src/server/rewrite.js";

const ROOT = "/project";
const IMPORTER = "/project/src/main.ts";

describe("inlineAssetImports", () => {
  it("inlines a relative asset import as its dev URL constant", () => {
    expect(inlineAssetImports(`import logo from "./logo.svg";`, IMPORTER, ROOT)).toBe(
      `const logo = "/src/logo.svg";`,
    );
  });

  it("resolves nested relative paths against the importer", () => {
    expect(inlineAssetImports(`import p from "../assets/p.png";`, IMPORTER, ROOT)).toBe(
      `const p = "/assets/p.png";`,
    );
  });

  it("keeps an already-absolute (alias-resolved) URL", () => {
    expect(inlineAssetImports(`import a from "/src/a.webp";`, IMPORTER, ROOT)).toBe(
      `const a = "/src/a.webp";`,
    );
  });

  it("matches the extension ignoring a query/hash (and serves the clean path)", () => {
    expect(inlineAssetImports(`import w from "./m.wasm?init";`, IMPORTER, ROOT)).toBe(
      `const w = "/src/m.wasm";`,
    );
  });

  it("leaves non-asset imports untouched", () => {
    const code = `import { x } from "./util.ts";`;
    expect(inlineAssetImports(code, IMPORTER, ROOT)).toBe(code);
  });

  it("leaves bare specifiers untouched", () => {
    const code = `import x from "some-pkg.png";`;
    expect(inlineAssetImports(code, IMPORTER, ROOT)).toBe(code);
  });

  it("composes with alias rewriting (alias → URL → inlined const)", () => {
    const aliased = rewriteImports(`import logo from "@/logo.svg";`, [{ find: "@", url: "/src" }]);
    expect(inlineAssetImports(aliased, IMPORTER, ROOT)).toBe(`const logo = "/src/logo.svg";`);
  });
});
