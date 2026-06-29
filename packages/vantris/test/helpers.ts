import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Config } from "../src/types/config.js";
import type { Context } from "../src/types/context.js";
import type { Logger } from "../src/types/logger.js";
import { resolveConfig } from "../src/config/resolve.js";
import { createResolver } from "../src/resolver/index.js";
import { runBuild, type BuildResult } from "../src/build/index.js";
import { detectHtmlEntry } from "../src/html/index.js";

/** A logger that records every message instead of printing. */
export interface CapturingLogger extends Logger {
  readonly messages: string[];
}

const tempDirs: string[] = [];

/** Creates a temporary project from a map of relative path → file contents. */
export async function makeProject(
  files: Record<string, string>,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vantris-test-"));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const file = join(dir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, "utf8");
  }
  return dir;
}

/** Removes every temp project created during the run. Call in `afterEach`. */
export async function cleanupProjects(): Promise<void> {
  await Promise.all(
    tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
}

/** A logger that records every message (tagged by level) instead of printing. */
export function silentLogger(): CapturingLogger {
  const messages: string[] = [];
  return {
    messages,
    info: (m) => void messages.push(`info ${m}`),
    success: (m) => void messages.push(`success ${m}`),
    warn: (m) => void messages.push(`warn ${m}`),
    error: (m) => void messages.push(`error ${m}`),
    debug: (m) => void messages.push(`debug ${m}`),
    print: (m) => void messages.push(m),
    link: (label, url) => `${label} (${url})`,
    dim: (text) => text,
    color: (text) => text,
    box: (lines, opts) =>
      void messages.push(`box ${opts?.title ? `[${opts.title}] ` : ""}${lines.join(" | ")}`),
    table: (rows) =>
      void messages.push(`table ${rows.map(([l, v]) => `${l}=${v}`).join(" ")}`),
    separator: () => void messages.push("separator"),
    title: (text) => void messages.push(`title ${text}`),
  };
}

/** Builds a {@link Context} for `dir` with a capturing logger. */
export function makeContext(
  dir: string,
  config: Config = {},
  options: { mode?: string; env?: Record<string, string> } = {},
): { ctx: Context; logger: CapturingLogger } {
  const logger = silentLogger();
  const resolved = resolveConfig(config, dir);
  const ctx: Context = {
    cwd: dir,
    config: resolved,
    logger,
    mode: options.mode ?? "test",
    env: options.env ?? {},
    resolver: createResolver(resolved.resolve),
  };
  return { ctx, logger };
}

/** Polls `condition` until it is true, or rejects after `timeout` ms. */
export async function waitFor(
  condition: () => boolean,
  timeout = 3000,
  interval = 25,
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("waitFor: timed out");
    await new Promise((r) => setTimeout(r, interval));
  }
}

/** Lists files under `dir` recursively, as sorted forward-slash paths. */
export async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (current: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(current, entry.name), rel);
      else out.push(rel);
    }
  };
  await walk(dir, "");
  return out.sort();
}

/** Reads a UTF-8 file relative to `dir`. */
export function read(dir: string, rel: string): Promise<string> {
  return readFile(join(dir, rel), "utf8");
}

export interface BuildRun {
  dir: string;
  result: BuildResult;
  logger: CapturingLogger;
  /** Sorted list of files emitted under `dist/`. */
  dist: string[];
}

/** Creates a temp project, runs a real build, and returns its outputs. */
export async function buildProject(
  files: Record<string, string>,
  config: Config = {},
  options: { mode?: string; env?: Record<string, string> } = {},
): Promise<BuildRun> {
  const dir = await makeProject(files);
  const { ctx, logger } = makeContext(dir, config, options);
  const entry = await detectHtmlEntry(ctx.config.paths.root);
  const result = await runBuild({ ctx, entry });
  return { dir, result, logger, dist: await listFiles(join(dir, "dist")) };
}
