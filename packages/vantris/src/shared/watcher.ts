import { watch, type FSWatcher } from "chokidar";
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

/**
 * Watches a directory tree and reports file changes.
 *
 * This is the single home for filesystem watching — the dev server depends on
 * the {@link Watcher} interface, not on chokidar, so the backing implementation
 * can change (or gain HMR-oriented metadata) without rippling outward.
 */
export function createWatcher(options: WatcherOptions): Watcher {
  const { dir, logger, onChange } = options;

  const watcher: FSWatcher = watch(dir, {
    ignoreInitial: true,
    persistent: true,
    ignored: (path) =>
      path.includes("node_modules") || /(^|[/\\])\.[^/\\]/.test(path),
  });

  const emit = (kind: WatchEvent["kind"]) => (file: string) => {
    logger.debug(`watch ${kind}: ${file}`);
    onChange({ kind, file });
  };

  watcher
    .on("add", emit("add"))
    .on("change", emit("change"))
    .on("unlink", emit("unlink"))
    .on("error", (error) =>
      logger.error(`watcher error: ${(error as Error).message}`),
    );

  return {
    close: () => watcher.close(),
  };
}
