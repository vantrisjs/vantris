import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Logger } from "../types/logger.js";
import { VERSION } from "../shared/constants.js";
import { formatBytes } from "../logger/index.js";

/** Fields for the dev/preview start panel. */
export interface ServerPanel {
  kind: "dev" | "preview";
  /** Local URL. */
  local: string;
  /** Network URL, or `null` to show the "expose" hint. */
  network: string | null;
  mode: string;
  startupMs: number;
  /** Optional served directory (preview). */
  serving?: string;
}

/** Prints an aligned, boxed start panel with clickable URLs. */
export function printServerPanel(logger: Logger, panel: ServerPanel): void {
  const label = (text: string) => logger.dim(text.padEnd(9));
  const rows = [`${label("Local")}${logger.link(panel.local, panel.local)}`];
  rows.push(
    panel.network
      ? `${label("Network")}${logger.link(panel.network, panel.network)}`
      : `${label("Network")}${logger.dim("use --host to expose")}`,
  );
  rows.push(`${label("Mode")}${panel.mode}`);
  if (panel.serving) rows.push(`${label("Serving")}${panel.serving}`);

  logger.print("");
  logger.box(rows, {
    title: `vantris v${VERSION} · ${panel.kind}`,
    padding: { x: 2, y: 1 },
  });
  logger.success(`ready in ${panel.startupMs} ms`);
}

/** A built file with its size (and gzip size for text assets). */
export interface OutputFileSize {
  rel: string;
  size: number;
  gzip: number | null;
}

const GZIP_EXT = /\.(js|mjs|css|html|json|svg)$/i;

/** Walks `outDir`, returning each file's path, size, and gzip size. */
export async function collectOutputs(
  outDir: string,
  root: string,
): Promise<OutputFileSize[]> {
  const files: OutputFileSize[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const { size } = await stat(full);
      const gzip = GZIP_EXT.test(entry.name)
        ? gzipSync(await readFile(full)).length
        : null;
      files.push({ rel: relative(root, full), size, gzip });
    }
  };
  await walk(outDir);
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

/** Prints a modern build summary: per-file sizes, totals, and duration. */
export function printBuildSummary(
  logger: Logger,
  files: readonly OutputFileSize[],
  durationMs: number,
): void {
  const nameWidth = Math.max(...files.map((f) => f.rel.length));
  const sizeWidth = Math.max(...files.map((f) => formatBytes(f.size).length));

  logger.print("");
  for (const file of files) {
    const name = logger.dim(file.rel.padEnd(nameWidth));
    const size = formatBytes(file.size).padStart(sizeWidth);
    const gzip = file.gzip !== null ? logger.dim(` │ gzip ${formatBytes(file.gzip)}`) : "";
    logger.print(`  ${name}  ${size}${gzip}`);
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);
  logger.print("");
  logger.success(
    `built ${files.length} files (${formatBytes(total)}) in ${durationMs} ms`,
  );
}
