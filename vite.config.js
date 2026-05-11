import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  oxc: {
    include: /\.(m?js|[jt]sx)$/,
    exclude: [],
    jsx: { runtime: "classic" },
  },
  plugins: [
    react({
      include: /app\/scripts\/.*\.[jt]sx?$/,
    }),
  ],
  server: {
    port: 1234,
  },
  optimizeDeps: {
    rolldownOptions: {
      moduleTypes: {
        ".js": "jsx",
      },
    },
  },
  build: {
    rolldownOptions: {
      moduleTypes: {
        ".js": "jsx",
      },
    },
    outDir: "build",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      app: resolve(__dirname, "app"),
    },
  },
});
