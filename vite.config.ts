import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const commit = env.VITE_GIT_COMMIT || env.GITHUB_SHA || "local";
  const version = env.VITE_APP_VERSION || process.env.npm_package_version || "0.1.0";

  return {
    base: "/anon-conf-poll/",
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __GIT_COMMIT__: JSON.stringify(commit.slice(0, 12))
    },
    build: {
      outDir: "docs",
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            yjs: ["yjs", "y-webrtc"],
            analytics: ["@duckdb/duckdb-wasm"],
            proof: [
              "@semaphore-protocol/group",
              "@semaphore-protocol/identity",
              "@semaphore-protocol/proof",
              "libsodium-wrappers-sumo"
            ]
          }
        }
      }
    },
    worker: {
      format: "es"
    }
  };
});
