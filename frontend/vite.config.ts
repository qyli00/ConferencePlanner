import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        xfwd: true,
      },
      "^/s(?:/|$)": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        planner: resolve(__dirname, "planner.html"),
        share: resolve(__dirname, "share.html"),
      },
    },
  },
});
