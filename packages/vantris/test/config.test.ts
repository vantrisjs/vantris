import { resolve } from "node:path";
import { describe, it } from "node:test";
import { expect } from "./utils/expect.js";
import { resolveConfig } from "../src/config/resolve.js";

const cwd = "/project";

describe("resolveConfig", () => {
  it("applies directory defaults as absolute paths", () => {
    const { paths } = resolveConfig({}, cwd);
    expect(paths.root).toBe(resolve("/project"));
    expect(paths.rootDir).toBe(resolve("/project/src"));
    expect(paths.publicDir).toBe(resolve("/project/public"));
    expect(paths.outDir).toBe(resolve("/project/dist"));
  });

  it("resolves directories relative to an explicit root", () => {
    const { paths } = resolveConfig({ root: "app" }, cwd);
    expect(paths.root).toBe(resolve("/project/app"));
    expect(paths.rootDir).toBe(resolve("/project/app/src"));
    expect(paths.outDir).toBe(resolve("/project/app/dist"));
  });

  it("defaults dev and build options", () => {
    const { dev, build } = resolveConfig({}, cwd);
    expect(dev).toEqual({ port: 3000, host: "localhost" });
    expect(build.minify).toBe(true);
    expect(build.sourcemap).toBe(false);
    expect(build.assetsDir).toBe("assets");
    expect(build.entryFileNames).toBe("assets/[name]-[hash].js");
    expect(build.chunkFileNames).toBe("assets/[name]-[hash].js");
    expect(build.assetFileNames).toBe("assets/[name]-[hash][extname]");
  });

  it("honours dev and build overrides", () => {
    const { dev, build } = resolveConfig(
      { dev: { port: 5173, host: "0.0.0.0" }, build: { minify: false } },
      cwd,
    );
    expect(dev).toEqual({ port: 5173, host: "0.0.0.0" });
    expect(build.minify).toBe(false);
  });

  it("defaults and overrides preview options", () => {
    expect(resolveConfig({}, cwd).preview).toEqual({
      port: 4173,
      host: "localhost",
      open: false,
    });
    expect(resolveConfig({ preview: { port: 5000, open: true } }, cwd).preview).toEqual({
      port: 5000,
      host: "localhost",
      open: true,
    });
  });

  it("derives fileNames from assetsDir, but explicit values win", () => {
    expect(resolveConfig({ build: { assetsDir: "static" } }, cwd).build.entryFileNames).toBe(
      "static/[name]-[hash].js",
    );
    expect(
      resolveConfig({ build: { entryFileNames: "js/app.js" } }, cwd).build.entryFileNames,
    ).toBe("js/app.js");
  });

  it("accepts a function for fileNames", () => {
    const fn = (chunk: { name: string }) => `js/${chunk.name}.js`;
    const { build } = resolveConfig({ build: { entryFileNames: fn } }, cwd);
    expect(build.entryFileNames).toBe(fn);
  });

  it("normalizes base to start and end with a slash", () => {
    expect(resolveConfig({}, cwd).base).toBe("/");
    expect(resolveConfig({ base: "app" }, cwd).base).toBe("/app/");
    expect(resolveConfig({ base: "/app" }, cwd).base).toBe("/app/");
    expect(resolveConfig({ base: "/app/" }, cwd).base).toBe("/app/");
    expect(resolveConfig({ base: "https://cdn.example.com/x" }, cwd).base).toBe(
      "https://cdn.example.com/x/",
    );
  });

  it("records the config file path", () => {
    expect(resolveConfig({}, cwd, "/project/vantris.config.ts").configFile).toBe(
      "/project/vantris.config.ts",
    );
    expect(resolveConfig({}, cwd).configFile).toBeNull();
  });
});
