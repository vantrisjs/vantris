/**
 * Parses the contents of a `.env` file into key/value pairs.
 *
 * Supports `KEY=value`, `export KEY=value`, `#` comments, blank lines, and
 * single/double-quoted values (with `\n`/`\r`/`\t` escapes inside double
 * quotes). Inline `#` comments are stripped from unquoted values.
 */
export function parseEnv(source: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of source.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(eq + 1).trim();

    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t");
      }
    } else {
      // Unquoted: drop an inline comment.
      const comment = value.indexOf(" #");
      if (comment !== -1) value = value.slice(0, comment).trim();
    }

    env[key] = value;
  }

  return env;
}
