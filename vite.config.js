import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(root, "web"),
  server: {
    host: "127.0.0.1",
    port: 43187,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 43187,
    strictPort: true,
  },
  build: {
    outDir: resolve(root, "dist"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@qr-invoice/core": resolve(root, "packages/core/src/index.js"),
      "@qr-invoice/pdf": resolve(root, "packages/pdf/src/index.js"),
    },
  },
});
