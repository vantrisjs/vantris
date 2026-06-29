import { describe, expect, it } from "vitest";
import { run } from "../src/cli/run.js";
import { silentLogger } from "./helpers.js";

describe("cli run()", () => {
  it("prints help when given no command", async () => {
    const logger = silentLogger();
    const code = await run([], { logger });
    expect(code).toBe(0);
    expect(logger.messages.join("\n")).toContain("Usage:");
  });

  it("prints help for --help", async () => {
    const logger = silentLogger();
    await run(["--help"], { logger });
    expect(logger.messages.join("\n")).toContain("Commands:");
  });

  it("prints the version for --version", async () => {
    const logger = silentLogger();
    await run(["--version"], { logger });
    expect(logger.messages.join("\n")).toMatch(/vantris v\d+\.\d+\.\d+/);
  });

  it("errors on an unknown command", async () => {
    const logger = silentLogger();
    const code = await run(["frobnicate"], { logger });
    expect(code).toBe(1);
    expect(logger.messages.join("\n")).toContain("Unknown command");
  });
});
