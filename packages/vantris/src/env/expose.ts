/**
 * Prefix marking environment variables safe to expose to client code via
 * `import.meta.env`. Everything else stays server-side only — secrets in
 * `.env` are never leaked into the bundle.
 */
export const ENV_PREFIX = "VANTRIS_";

/** The shape exposed to client code as `import.meta.env`. */
export type ClientEnv = Record<string, string | boolean>;

/**
 * Builds the `import.meta.env` object: the built-ins (`MODE`, `DEV`, `PROD`,
 * `BASE_URL`) plus every {@link ENV_PREFIX}-prefixed variable.
 */
export function clientEnv(
  env: Record<string, string>,
  mode: string,
  base: string,
  prefix: string = ENV_PREFIX,
): ClientEnv {
  const exposed: ClientEnv = {
    MODE: mode,
    DEV: mode !== "production",
    PROD: mode === "production",
    BASE_URL: base,
  };
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(prefix)) exposed[key] = value;
  }
  return exposed;
}

/**
 * Builds the `define` map (token → JSON literal) injected by the dev transpiler
 * and the production bundler, so `import.meta.env.X` is statically replaced.
 */
export function envDefine(
  env: Record<string, string>,
  mode: string,
  base: string,
  prefix: string = ENV_PREFIX,
): Record<string, string> {
  const exposed = clientEnv(env, mode, base, prefix);
  const define: Record<string, string> = {
    "import.meta.env": JSON.stringify(exposed),
  };
  for (const [key, value] of Object.entries(exposed)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }
  return define;
}
