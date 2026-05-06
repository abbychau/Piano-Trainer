import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    {
      name: "treat-js-files-as-jsx",
      async transform(code, id) {
        const normalizedId = id.replace(/\\/g, "/");
        if (!normalizedId.includes("/app/scripts/") || !normalizedId.endsWith(".js")) {
          return null;
        }
        return transformWithEsbuild(code, normalizedId, {
          loader: "jsx",
          jsx: "transform",
        });
      },
    },
    react(),
  ],
  server: {
    port: 1234,
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      app: resolve(__dirname, "app"),
    },
  },
});
