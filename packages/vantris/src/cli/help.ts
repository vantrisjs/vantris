import { commands } from "../commands/index.js";
import { APP_NAME, VERSION } from "../shared/constants.js";

/** Builds the help text listing every registered command. */
export function helpText(): string {
  const lines = [
    `${APP_NAME} v${VERSION} — a modern bundler for JavaScript/TypeScript`,
    "",
    "Usage:",
    `  ${APP_NAME} <command> [options]`,
    "",
    "Commands:",
  ];

  const width = Math.max(...Object.keys(commands).map((n) => n.length));
  for (const command of Object.values(commands)) {
    lines.push(`  ${command.name.padEnd(width)}  ${command.description}`);
  }

  lines.push(
    "",
    "Options:",
    "  --mode <mode>  Set the mode (e.g. development, production, staging)",
    "  -h, --help     Show this help",
    "  -v, --version  Show the version number",
    "  --verbose      Verbose logging",
  );

  return lines.join("\n");
}

/** Builds the version line. */
export function versionText(): string {
  return `${APP_NAME} v${VERSION}`;
}
