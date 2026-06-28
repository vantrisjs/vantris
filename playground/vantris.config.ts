import { defineConfig } from "vantris";

export default defineConfig({
  rootDir: "./src",
  publicDir: "./public",
  outDir: "./dist",
  dev: {
    port: 3000,
    host: "localhost",
  },
  build: {
    minify: true,
    sourcemap: false,
  },
});
