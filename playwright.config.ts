import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT || 3100);
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30000,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: "chrome", trace: "retain-on-failure" },
  webServer:
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === "true"
      ? undefined
      : {
          command: `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${port}`,
          url: `http://127.0.0.1:${port}`,
          reuseExistingServer: false,
          timeout: 120000,
        },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
