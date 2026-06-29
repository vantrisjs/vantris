import { describe, expect, it } from "vitest";
import {
  BuildError,
  ConfigError,
  HtmlEntryError,
  PreviewError,
  ServerError,
  VantrisError,
  isVantrisError,
} from "../src/shared/errors.js";

describe("error hierarchy", () => {
  it("every domain error extends VantrisError with a distinct name", () => {
    const cases = [
      [new ConfigError("x"), "ConfigError"],
      [new HtmlEntryError("x"), "HtmlEntryError"],
      [new BuildError("x"), "BuildError"],
      [new ServerError("x"), "ServerError"],
      [new PreviewError("x"), "PreviewError"],
    ] as const;
    for (const [error, name] of cases) {
      expect(error).toBeInstanceOf(VantrisError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe(name);
    }
  });

  it("isVantrisError narrows only Vantris errors", () => {
    expect(isVantrisError(new ConfigError("x"))).toBe(true);
    expect(isVantrisError(new Error("x"))).toBe(false);
    expect(isVantrisError("x")).toBe(false);
    expect(isVantrisError(null)).toBe(false);
  });

  it("preserves the underlying cause", () => {
    const cause = new Error("root");
    expect(new BuildError("wrap", { cause }).cause).toBe(cause);
  });
});
