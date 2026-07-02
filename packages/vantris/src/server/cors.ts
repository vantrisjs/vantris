import type { ResolvedCors } from "../types/config-resolved.js";

/**
 * Computes the CORS response headers for a request, or `null` when the origin
 * is not allowed. Runtime-agnostic: both the Node and Bun servers apply the
 * same policy.
 */
export function corsHeaders(
  cors: ResolvedCors,
  requestOrigin: string | undefined,
): Record<string, string> | null {
  const allowed = resolveOrigin(cors.origin, requestOrigin);
  if (allowed === null) return null;

  const headers: Record<string, string> = {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": cors.methods.join(", "),
  };
  if (cors.headers.length > 0) {
    headers["access-control-allow-headers"] = cors.headers.join(", ");
  }
  if (cors.credentials) {
    headers["access-control-allow-credentials"] = "true";
  }
  // When the allowed origin varies by request, caches must key on Origin.
  if (allowed !== "*") headers["vary"] = "Origin";
  return headers;
}

/** Resolves the `Access-Control-Allow-Origin` value, or `null` if disallowed. */
function resolveOrigin(
  origin: ResolvedCors["origin"],
  requestOrigin: string | undefined,
): string | null {
  if (origin === true) return requestOrigin ?? "*";
  if (origin === false) return null;
  if (typeof origin === "string") return origin;
  // Array: reflect the request origin only when it is in the allow-list.
  if (requestOrigin && origin.includes(requestOrigin)) return requestOrigin;
  return null;
}

/** Whether a request is a CORS preflight (`OPTIONS` + the preflight header). */
export function isPreflight(
  method: string,
  accessControlRequestMethod: string | undefined,
): boolean {
  return method === "OPTIONS" && accessControlRequestMethod !== undefined;
}
