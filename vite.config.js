import { defineConfig } from "vite";

export default defineConfig({
  root:   "web",
  server: { host: "127.0.0.1", port: 43187, strictPort: true },
  optimizeDeps: { exclude: ["@napi-rs/canvas"] },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: { external: ["@napi-rs/canvas"] },
  },
});
