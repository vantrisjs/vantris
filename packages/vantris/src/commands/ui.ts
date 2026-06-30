import { brotliCompressSync, gzipSync } from "node:zlib";
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

/** How a built file is classified in the summary. */
export type OutputKind = "chunk" | "css" | "html" | "asset" | "map";

/** A built file with its size and (for text assets) compressed sizes. */
export interface OutputFileSize {
  rel: string;
  size: number;
  /** gzip size, or `null` for binary assets. */
  gzip: number | null;
  /** brotli size, or `null` for binary assets. */
  brotli: number | null;
  kind: OutputKind;
}

/** Extensions worth compressing for the size report. */
const COMPRESSIBLE = /\.(js|mjs|cjs|css|html|json|svg|txt|map|wasm)$/i;

/** Classifies a file by extension for the summary. */
function classify(name: string): OutputKind {
  if (/\.map$/i.test(name)) return "map";
  if (/\.(js|mjs|cjs)$/i.test(name)) return "chunk";
  if (/\.css$/i.test(name)) return "css";
  if (/\.html?$/i.test(name)) return "html";
  return "asset";
}

/** Walks `outDir`, returning each file's path, size, and compressed sizes. */
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
      let gzip: number | null = null;
      let brotli: number | null = null;
      if (COMPRESSIBLE.test(entry.name)) {
        const data = await readFile(full);
        gzip = gzipSync(data).length;
        brotli = brotliCompressSync(data).length;
      }
      files.push({ rel: relative(root, full), size, gzip, brotli, kind: classify(entry.name) });
    }
  };
  await walk(outDir);
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Prints a modern build summary: each emitted file with its raw, gzip, and
 * brotli sizes, followed by totals (file/chunk/asset counts, combined sizes,
 * duration, output directory). Source maps are excluded from the listing.
 */
export function printBuildSummary(
  logger: Logger,
  files: readonly OutputFileSize[],
  durationMs: number,
): void {
  const shown = files.filter((file) => file.kind !== "map");
  const nameWidth = Math.max(0, ...shown.map((f) => f.rel.length));
  const sizeWidth = Math.max(0, ...shown.map((f) => formatBytes(f.size).length));

  logger.print("");
  for (const file of shown) {
    const name = logger.dim(file.rel.padEnd(nameWidth));
    const size = formatBytes(file.size).padStart(sizeWidth);
    const gzip = file.gzip !== null ? logger.dim(` │ gzip ${formatBytes(file.gzip)}`) : "";
    const brotli = file.brotli !== null ? logger.dim(` │ br ${formatBytes(file.brotli)}`) : "";
    logger.print(`  ${name}  ${size}${gzip}${brotli}`);
  }

  const chunks = shown.filter((f) => f.kind === "chunk").length;
  const assets = shown.length - chunks;
  const totalSize = shown.reduce((sum, f) => sum + f.size, 0);
  const totalGzip = shown.reduce((sum, f) => sum + (f.gzip ?? 0), 0);
  const totalBrotli = shown.reduce((sum, f) => sum + (f.brotli ?? 0), 0);

  logger.print("");
  logger.success(
    `built ${shown.length} files · ${chunks} ${chunks === 1 ? "chunk" : "chunks"} · ` +
      `${assets} ${assets === 1 ? "asset" : "assets"} in ${durationMs} ms`,
  );
  logger.print(
    logger.dim(
      `  ${formatBytes(totalSize)} · gzip ${formatBytes(totalGzip)} · brotli ${formatBytes(totalBrotli)}`,
    ),
  );
}
