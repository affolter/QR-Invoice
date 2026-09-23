import { defineConfig } from "vite";

export default defineConfig({
  root:   "web",
  server: { host: "127.0.0.1", port: 43187, strictPort: true },
  build:  { outDir: "../dist", emptyOutDir: true },
});
