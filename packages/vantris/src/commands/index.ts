import type { Command } from "../types/command.js";
import { dev } from "./dev.js";
import { build } from "./build.js";
import { preview } from "./preview.js";

/**
 * The command registry. The CLI routes purely against this map, so adding a
 * command is a one-line registration here plus its module — no CLI changes.
 */
export const commands: Readonly<Record<string, Command>> = {
  [dev.name]: dev,
  [build.name]: build,
  [preview.name]: preview,
};

export type CommandName = keyof typeof commands;

export { dev, build, preview };
