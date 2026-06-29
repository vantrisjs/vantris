import type { Logger } from "../types/logger.js";
import { commands } from "../commands/index.js";
import { APP_NAME, VERSION } from "../shared/constants.js";

const BRAND = "#a78bfa";

/** Builds the styled help text listing every registered command. */
export function helpText(logger: Logger): string {
  const brand = (text: string) => logger.color(text, BRAND);
  const lines = [
    `${brand(APP_NAME)} ${logger.dim(`v${VERSION}`)} ${logger.dim("— a modern bundler for JavaScript/TypeScript")}`,
    "",
    logger.dim("Usage:"),
    `  ${brand(APP_NAME)} <command> [options]`,
    "",
    logger.dim("Commands:"),
  ];

  const width = Math.max(...Object.keys(commands).map((n) => n.length));
  for (const command of Object.values(commands)) {
    lines.push(`  ${brand(command.name.padEnd(width))}  ${logger.dim(command.description)}`);
  }

  lines.push(
    "",
    logger.dim("Options:"),
    `  ${"--mode <mode>".padEnd(15)} ${logger.dim("Set the mode (development, production, …)")}`,
    `  ${"-h, --help".padEnd(15)} ${logger.dim("Show this help")}`,
    `  ${"-v, --version".padEnd(15)} ${logger.dim("Show the version number")}`,
    `  ${"--verbose".padEnd(15)} ${logger.dim("Verbose logging")}`,
  );

  return lines.join("\n");
}

/** Builds the styled version line. */
export function versionText(logger: Logger): string {
  return `${logger.color(APP_NAME, BRAND)} v${VERSION}`;
}
