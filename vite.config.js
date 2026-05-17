import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  // Support deployment to subfolders (e.g., GitHub Pages: /Piano-Trainer/)
  // Override with: BASE_URL=/Piano-Trainer/ npm run build
  base: process.env.BASE_URL || "/",
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
