import { describe, expect, it } from "vitest";
import { injectDevClient, parseHtml } from "../src/html/index.js";

describe("parseHtml", () => {
  it("extracts a module script src", () => {
    const { scripts } = parseHtml(
      "/x/index.html",
      `<script type="module" src="/src/main.ts"></script>`,
    );
    expect(scripts).toEqual([{ src: "/src/main.ts" }]);
  });

  it("handles multiple scripts, single quotes, and attribute order", () => {
    const html = `<script src='/a.ts' type="module"></script><script type="module" src="/b.ts"></script>`;
    expect(parseHtml("i", html).scripts.map((s) => s.src)).toEqual(["/a.ts", "/b.ts"]);
  });

  it("ignores non-module and src-less scripts", () => {
    const html = `<script src="/x.js"></script><script type="module">inline()</script>`;
    expect(parseHtml("i", html).scripts).toEqual([]);
  });
});

describe("injectDevClient", () => {
  it("injects before </head> when present", () => {
    const out = injectDevClient("<head></head><body></body>");
    expect(out).toContain("Injected by Vantris");
    expect(out.indexOf("Injected by Vantris")).toBeLessThan(out.indexOf("</head>"));
  });

  it("falls back to </body> when there is no head", () => {
    const out = injectDevClient("<body><main></main></body>");
    expect(out.indexOf("Injected by Vantris")).toBeLessThan(out.indexOf("</body>"));
  });

  it("appends when there is neither head nor body", () => {
    const out = injectDevClient("<div>hi</div>");
    expect(out).toContain("Injected by Vantris");
    expect(out.trimEnd().endsWith("</script>")).toBe(true);
  });
});
