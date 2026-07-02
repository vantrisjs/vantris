import { afterEach, describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import {
  clientEnv,
  envDefine,
  envFilesFor,
  loadEnv,
  parseEnv,
} from "../src/env/index.js";
import { cleanupProjects, makeProject } from "./utils/helpers.js";

afterEach(cleanupProjects);

describe("parseEnv", () => {
  it("parses assignments, quotes, comments, and export", () => {
    const env = parseEnv(
      [
        "# a comment",
        "FOO=bar",
        "export BAZ=qux",
        'QUOTED="hello world"',
        "SINGLE='a b'",
        "INLINE=val # trailing",
        "EMPTY=",
      ].join("\n"),
    );
    expect(env).toEqual({
      FOO: "bar",
      BAZ: "qux",
      QUOTED: "hello world",
      SINGLE: "a b",
      INLINE: "val",
      EMPTY: "",
    });
  });

  it("expands escapes inside double quotes only", () => {
    expect(parseEnv('X="a\\nb"').X).toBe("a\nb");
    expect(parseEnv("Y='a\\nb'").Y).toBe("a\\nb");
  });

  it("ignores invalid keys", () => {
    expect(parseEnv("1BAD=x\n=y\nGOOD=z")).toEqual({ GOOD: "z" });
  });
});

describe("loadEnv", () => {
  it("lists files in ascending priority", () => {
    expect(envFilesFor("production")).toEqual([
      ".env",
      ".env.local",
      ".env.production",
      ".env.production.local",
    ]);
  });

  it("merges with .env.[mode].local winning", async () => {
    const dir = await makeProject({
      ".env": "A=base\nB=base\nC=base\nD=base",
      ".env.local": "B=local",
      ".env.production": "C=mode",
      ".env.production.local": "D=modelocal",
    });
    expect(await loadEnv("production", dir)).toEqual({
      A: "base",
      B: "local",
      C: "mode",
      D: "modelocal",
    });
  });

  it("loads only the active mode's files", async () => {
    const dir = await makeProject({
      ".env": "X=base",
      ".env.development": "X=dev",
      ".env.production": "X=prod",
    });
    expect((await loadEnv("development", dir)).X).toBe("dev");
    expect((await loadEnv("production", dir)).X).toBe("prod");
    expect((await loadEnv("staging", dir)).X).toBe("base");
  });

  it("returns empty when there are no env files", async () => {
    const dir = await makeProject({ "src/x.ts": "export {};" });
    expect(await loadEnv("development", dir)).toEqual({});
  });
});

describe("env exposure", () => {
  it("exposes only prefixed variables plus built-ins", () => {
    const exposed = clientEnv({ VANTRIS_API: "x", SECRET: "y" }, "production", "/");
    expect(exposed).toEqual({
      MODE: "production",
      DEV: false,
      PROD: true,
      BASE_URL: "/",
      VANTRIS_API: "x",
    });
    expect(exposed.SECRET).toBeUndefined();
  });

  it("builds a define map (and never includes secrets)", () => {
    const define = envDefine({ VANTRIS_API: "x", SECRET: "y" }, "development", "/app/");
    expect(define["import.meta.env.MODE"]).toBe('"development"');
    expect(define["import.meta.env.DEV"]).toBe("true");
    expect(define["import.meta.env.BASE_URL"]).toBe('"/app/"');
    expect(define["import.meta.env.VANTRIS_API"]).toBe('"x"');
    expect(JSON.stringify(define)).not.toContain("SECRET");
  });
});
