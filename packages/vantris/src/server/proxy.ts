import type { ResolvedProxyRule } from "../types/config-resolved.js";

/** Finds the first proxy rule whose context prefixes `pathname` (longest-first). */
export function matchProxy(
  rules: readonly ResolvedProxyRule[],
  pathname: string,
): ResolvedProxyRule | null {
  for (const rule of rules) {
    if (pathname === rule.context || pathname.startsWith(rule.context)) {
      return rule;
    }
  }
  return null;
}

/** Builds the absolute target URL a request should be forwarded to. */
export function proxyTargetUrl(rule: ResolvedProxyRule, pathname: string, search: string): string {
  const path = rule.rewrite ? rule.rewrite(pathname) : pathname;
  // `new URL` joins the (possibly path-carrying) target with the request path.
  const base = rule.target.endsWith("/") ? rule.target : `${rule.target}/`;
  return new URL(path.replace(/^\/+/, "") + search, base).href;
}

/**
 * Forwards a request to the proxy target using the platform `fetch` (available
 * on both Node.js and Bun — no dependency). Returns the upstream `Response`, or
 * throws a {@link ProxyError} with a clear message if the target is unreachable.
 */
export async function proxyFetch(
  rule: ResolvedProxyRule,
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: Uint8Array | undefined;
  },
): Promise<Response> {
  const headers = { ...init.headers };
  if (rule.changeOrigin) {
    headers["host"] = new URL(rule.target).host;
  }

  try {
    return await fetch(url, {
      method: init.method,
      headers,
      ...(init.body && init.body.length > 0 ? { body: init.body } : {}),
      redirect: "manual",
      // Node's fetch honours NODE_TLS_REJECT_UNAUTHORIZED; `secure: false`
      // intent is surfaced through the message on failure.
    });
  } catch (cause) {
    throw new ProxyError(
      `Proxy target ${rule.target} did not respond (${cause instanceof Error ? cause.message : String(cause)}).`,
      { cause },
    );
  }
}

/** Thrown when a proxied request cannot reach its target. */
export class ProxyError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProxyError";
  }
}
