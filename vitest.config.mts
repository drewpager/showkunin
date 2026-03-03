import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    exclude: ["node_modules/**/*"],
    environment: "jsdom",
    // Browser testing configuration (for component tests)
    browser: {
      enabled: false, // Set to true or use --browser flag to run browser tests
      name: "chromium",
      provider: "playwright",
    }
  },
});
