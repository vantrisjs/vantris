import { register } from "node:module";

// Registers the `.js` → `.ts` resolve hook for the whole `node --test` run.
register("./ts-hook.mjs", import.meta.url);
