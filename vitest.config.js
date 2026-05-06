import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["app/scripts/spec/*.js"],
    setupFiles: ["./vitest.setup.js"],
  },
});
