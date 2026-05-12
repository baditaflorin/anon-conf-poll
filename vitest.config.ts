import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror vite.config.ts: the ESM build of libsodium-wrappers imports
      // a sibling file that npm doesn't ship, so we pin everything to the
      // self-contained CJS bundle.
      "libsodium-wrappers": resolve(
        process.cwd(),
        "node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js"
      )
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    css: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    server: {
      deps: {
        inline: ["libsodium-wrappers"]
      }
    }
  }
});
