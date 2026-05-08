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
    baseURL: "http://127.0.0.1:4175/anon-conf-poll/",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175/anon-conf-poll/",
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  }
});
