import type { Theme } from "./theme.js";

const OSC8 = "\x1b]8;;";
const BEL = "\x07";

/** Wraps `text` in an OSC 8 terminal hyperlink pointing at `url`. */
export function hyperlink(text: string, url: string): string {
  return `${OSC8}${url}${BEL}${text}${OSC8}${BEL}`;
}

/**
 * Renders a labelled link. With OSC 8 support, only the (styled) label shows
 * and is clickable; otherwise it falls back to `label (url)`.
 */
export function renderLink(
  label: string,
  url: string,
  theme: Theme,
  supportsHyperlinks: boolean,
): string {
  const styled = theme.link(label);
  if (supportsHyperlinks) return hyperlink(styled, url);
  return label === url ? styled : `${styled} ${theme.dim(`(${url})`)}`;
}

// http(s) URLs, or bare localhost/IPv4 with an explicit port (avoids matching
// the word "localhost" in prose).
const URL_RE =
  /(https?:\/\/[^\s)]+)|((?:localhost|\d{1,3}(?:\.\d{1,3}){3}):\d+(?:\/[^\s)]*)?)/g;

/**
 * Auto-detects URLs (including localhost and IP addresses) in `text` and styles
 * them — coloured, underlined, and clickable when the terminal supports it. No
 * developer intervention required.
 */
export function autolink(
  text: string,
  theme: Theme,
  supportsHyperlinks: boolean,
): string {
  if (!URL_RE.test(text)) return text;
  URL_RE.lastIndex = 0;
  return text.replace(URL_RE, (match) => {
    const url = match.startsWith("http") ? match : `http://${match}`;
    return renderLink(match, url, theme, supportsHyperlinks);
  });
}
