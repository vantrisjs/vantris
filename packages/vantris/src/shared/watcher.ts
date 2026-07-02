import { existsSync, statSync, watch, type FSWatcher } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { Logger } from "../types/logger.js";

/** A change reported by the {@link Watcher}. */
export interface WatchEvent {
  /** What happened to the file. */
  kind: "add" | "change" | "unlink";
  /** Absolute path of the affected file. */
  file: string;
}

export interface WatcherOptions {
  /** Directory tree(s) or file(s) to watch (typically `rootDir`). */
  dir: string | string[];
  logger: Logger;
  /** Called on every relevant filesystem change. */
  onChange: (event: WatchEvent) => void;
}

/** A running filesystem watcher. */
export interface Watcher {
  /** Stops watching and releases OS resources. */
  close(): Promise<void>;
}

/** Ignores `node_modules` and dotfiles anywhere in the relative path. */
const IGNORED = /(^|[/\\])(node_modules|\.[^/\\]+)([/\\]|$)/;

/** Coalesces the duplicate events `fs.watch` fires for a single save. */
const DEDUPE_MS = 30;

/**
 * Watches a directory tree (or file) and reports changes — built on the native
 * `node:fs.watch` (recursive), with **no external dependency**. It works
 * identically on Node.js and Bun.
 *
 * `fs.watch` only reports *that* something changed, not add vs change vs
 * unlink, so kinds are derived from a seeded set of known files plus a liveness
 * check: an existing unknown file is an `add`, a vanished known file an
 * `unlink`, and anything else a `change`.
 */
export function createWatcher(options: WatcherOptions): Watcher {
  const { logger, onChange } = options;
  const targets = Array.isArray(options.dir) ? options.dir : [options.dir];
  const watchers: FSWatcher[] = [];
  const known = new Set<string>();
  const recent = new Map<string, number>();

  const emit = (file: string, rel: string): void => {
    if (IGNORED.test(rel)) return;

    let kind: WatchEvent["kind"];
    if (existsSync(file)) {
      kind = known.has(file) ? "change" : "add";
      known.add(file);
    } else {
      if (!known.has(file)) return; // unknown file removed — nothing to report
      known.delete(file);
      kind = "unlink";
    }

    const key = `${kind}:${file}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last !== undefined && now - last < DEDUPE_MS) return;
    recent.set(key, now);

    logger.debug(`watch ${kind}: ${file}`);
    onChange({ kind, file });
  };

  for (const target of targets) {
    let isDirectory = true;
    try {
      isDirectory = statSync(target).isDirectory();
    } catch {
      continue; // target doesn't exist (yet) — skip it
    }

    if (isDirectory) void seed(target, known);

    try {
      const watcher = watch(
        target,
        { recursive: isDirectory, persistent: true },
        (_eventType, filename) => {
          if (isDirectory) {
            if (!filename) return;
            const rel = filename.toString();
            emit(join(target, rel), rel);
          } else {
            emit(target, basename(target));
          }
        },
      );
      watcher.on("error", (error: Error) =>
        logger.error(`watcher error: ${error.message}`),
      );
      watchers.push(watcher);
    } catch (error) {
      logger.error(`watcher error: ${(error as Error).message}`);
    }
  }

  return {
    close() {
      for (const watcher of watchers) watcher.close();
      watchers.length = 0;
      known.clear();
      recent.clear();
      return Promise.resolve();
    },
  };
}

/** Seeds `known` with the files already present under `dir`. */
async function seed(dir: string, known: Set<string>): Promise<void> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = join(entry.parentPath, entry.name);
      if (!IGNORED.test(relative(dir, full))) known.add(full);
    }
  } catch {
    // best-effort seeding — an unreadable subtree just means those files are
    // first reported as `add` rather than `change`.
  }
}
