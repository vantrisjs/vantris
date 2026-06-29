/**
 * Ambient types for Vantris client code.
 *
 * Reference it once — either in tsconfig:
 *
 * ```jsonc
 * { "compilerOptions": { "types": ["vantris/client"] } }
 * ```
 *
 * or with a triple-slash directive in any source file:
 *
 * ```ts
 * /// <reference types="vantris/client" />
 * ```
 *
 * It types `import.meta.env` and the asset/CSS module imports Vantris handles,
 * so no hand-written `.d.ts` is needed in your project.
 */

interface ImportMetaEnv {
  /** Active mode, e.g. `"development"`, `"production"`, or a custom mode. */
  readonly MODE: string;
  /** `true` when the mode is not `"production"`. */
  readonly DEV: boolean;
  /** `true` when the mode is `"production"`. */
  readonly PROD: boolean;
  /** The configured public base path. */
  readonly BASE_URL: string;
  /** User-defined, `VANTRIS_`-prefixed variables exposed to the client. */
  readonly [key: `VANTRIS_${string}`]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Assets imported from JS resolve to their (hashed) URL.
declare module "*.svg" {
  const src: string;
  export default src;
}
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.gif" {
  const src: string;
  export default src;
}
declare module "*.webp" {
  const src: string;
  export default src;
}
declare module "*.avif" {
  const src: string;
  export default src;
}
declare module "*.ico" {
  const src: string;
  export default src;
}
declare module "*.bmp" {
  const src: string;
  export default src;
}
declare module "*.woff" {
  const src: string;
  export default src;
}
declare module "*.woff2" {
  const src: string;
  export default src;
}
declare module "*.ttf" {
  const src: string;
  export default src;
}
declare module "*.otf" {
  const src: string;
  export default src;
}

// CSS Modules expose a class-name map; plain stylesheets are side-effect imports.
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
declare module "*.module.scss" {
  const classes: Record<string, string>;
  export default classes;
}
declare module "*.module.less" {
  const classes: Record<string, string>;
  export default classes;
}
declare module "*.css" {
  const styles: Record<string, string>;
  export default styles;
}
declare module "*.scss" {
  const styles: Record<string, string>;
  export default styles;
}
declare module "*.less" {
  const styles: Record<string, string>;
  export default styles;
}
