import { spawn } from "node:child_process";

/**
 * Opens `url` in the system default browser. Best-effort and non-blocking —
 * failures are swallowed so they never crash a server.
 *
 * Cross-platform: `open` (macOS), `start` via `cmd` (Windows), `xdg-open`
 * (Linux/BSD).
 */
export function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["/c", "start", "", url] : [url];

  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* best-effort: never throw from opening a browser */
  }
}
