import { defineConfig } from "./apps/web/node_modules/@playwright/test/index";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5175",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: ".venv/bin/python tests/e2e/start_api.py",
      url: "http://127.0.0.1:8011/api/v1/health",
      timeout: 30000,
      reuseExistingServer: false,
    },
    {
      command: "npm --prefix apps/web run dev -- --port 5175",
      url: "http://127.0.0.1:5175",
      env: { API_PROXY: "http://127.0.0.1:8011" },
      timeout: 30000,
      reuseExistingServer: false,
    },
  ],
});
