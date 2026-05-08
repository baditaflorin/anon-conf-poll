import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const commit = env.VITE_GIT_COMMIT || env.GITHUB_SHA || "local";
  const version = env.VITE_APP_VERSION || process.env.npm_package_version || "0.1.0";

  return {
    base: "/anon-conf-poll/",
    plugins: [react()],
    resolve: {
      alias: {
        "libsodium-wrappers": resolve(
          process.cwd(),
          "node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js"
        )
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __GIT_COMMIT__: JSON.stringify(commit.slice(0, 12))
    },
    build: {
      outDir: "docs",
      emptyOutDir: false,
      sourcemap: true
    },
    worker: {
      format: "es"
    }
  };
});
