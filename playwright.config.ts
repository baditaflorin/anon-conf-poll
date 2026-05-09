import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:43175/anon-conf-poll/",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 43175 --strictPort",
    url: "http://127.0.0.1:43175/anon-conf-poll/",
    reuseExistingServer: false,
    timeout: 20_000
  }
});
