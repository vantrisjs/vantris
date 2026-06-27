import type { Context } from "./context.js";

/**
 * A single CLI command. The CLI layer only knows about this contract; it never
 * contains command logic itself. New commands are added by implementing this
 * interface and registering them — no CLI refactor required.
 */
export interface Command {
  /** Invocation name, e.g. `"dev"`. */
  readonly name: string;
  /** One-line description shown in help output. */
  readonly description: string;
  /**
   * Execute the command.
   *
   * @param ctx  Fully-built execution context.
   * @param args Remaining positional/flag arguments after the command name.
   */
  run(ctx: Context, args: readonly string[]): Promise<void> | void;
}
