/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const usePolling = process.env.VITE_USE_POLLING === "true";

export default defineConfig({
  cacheDir: "/tmp/datanexus-vite-cache",
  build: {
    outDir: "/tmp/datanexus-frontend-dist",
    emptyOutDir: true,
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      usePolling,
    },
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://backend:8000",
        changeOrigin: true,
      },
    },
  },
});
