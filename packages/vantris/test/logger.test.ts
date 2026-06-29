import { describe, expect, it } from "vitest";
import { createLogger } from "../src/shared/logger.js";

function capture() {
  const out: string[] = [];
  const sink = {
    log: (m: string) => void out.push(m),
    warn: (m: string) => void out.push(m),
    error: (m: string) => void out.push(m),
  };
  return { out, sink };
}

describe("createLogger levels", () => {
  it("defaults to info: shows info/warn/error, hides debug", () => {
    const { out, sink } = capture();
    const log = createLogger({ sink });
    log.debug("DBG");
    log.info("INF");
    log.warn("WRN");
    log.error("ERR");
    const joined = out.join("|");
    expect(joined).not.toContain("DBG");
    expect(joined).toContain("INF");
    expect(joined).toContain("WRN");
    expect(joined).toContain("ERR");
  });

  it("verbose enables debug", () => {
    const { out, sink } = capture();
    createLogger({ verbose: true, sink }).debug("DBG");
    expect(out.join("|")).toContain("DBG");
  });

  it("level 'warn' suppresses info and debug", () => {
    const { out, sink } = capture();
    const log = createLogger({ level: "warn", sink });
    log.info("INF");
    log.debug("DBG");
    log.warn("WRN");
    log.error("ERR");
    expect(out).toHaveLength(2);
  });

  it("level 'silent' suppresses everything", () => {
    const { out, sink } = capture();
    const log = createLogger({ level: "silent", sink });
    log.error("ERR");
    log.info("INF");
    expect(out).toEqual([]);
  });
});
