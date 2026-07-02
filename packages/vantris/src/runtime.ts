/** The JavaScript runtime Vantris is executing under. */
export type Runtime = "node" | "bun";

// `Bun` is a global injected by the Bun runtime; declared here so detection
// type-checks without pulling in Bun's type packages.
declare const Bun: unknown;

/**
 * Detects the current runtime.
 *
 * The dev server dispatches on this to pick the native HTTP + WebSocket
 * implementation — `Bun.serve` under Bun, `node:http` under Node.js.
 *
 * @throws when neither Bun nor Node.js is detected.
 */
export function getRuntime(): Runtime {
  if (typeof Bun !== "undefined") return "bun";
  if (typeof process !== "undefined" && process.versions?.node) return "node";
  throw new Error("Unsupported runtime: Vantris requires Node.js or Bun.");
}
