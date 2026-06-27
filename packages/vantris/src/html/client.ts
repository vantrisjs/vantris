/**
 * The dev-only live-reload client, injected into the served HTML.
 *
 * v0.2.0 does a full page reload on any change. The WebSocket URL is derived
 * from `location.host` so it works regardless of how the host is addressed
 * (`localhost`, `127.0.0.1`, LAN IP). The message payload is ignored for now;
 * v1.x will branch on it to drive HMR instead of a full reload.
 */
export const DEV_CLIENT_SCRIPT = `<script type="module">
  // Injected by Vantris dev server — live reload (full page).
  const connect = () => {
    const ws = new WebSocket("ws://" + location.host);
    ws.addEventListener("message", () => location.reload());
    // Reconnect if the dev server restarts.
    ws.addEventListener("close", () => setTimeout(connect, 1000));
  };
  connect();
</script>`;

/**
 * Injects {@link DEV_CLIENT_SCRIPT} into an HTML document.
 *
 * The script is placed just before `</head>` when present, otherwise before
 * `</body>`, otherwise appended — so it loads before user modules without
 * requiring a well-formed document.
 */
export function injectDevClient(html: string): string {
  if (html.includes("</head>")) {
    return html.replace("</head>", `${DEV_CLIENT_SCRIPT}\n</head>`);
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `${DEV_CLIENT_SCRIPT}\n</body>`);
  }
  return `${html}\n${DEV_CLIENT_SCRIPT}`;
}
