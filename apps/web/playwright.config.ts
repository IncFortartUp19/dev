import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL:
      process.env.QA_BASE_URL ??
      (process.env.RUN_CONNECTED_E2E === "1"
        ? "http://localhost:3400"
        : "http://127.0.0.1:3100"),
    ignoreHTTPSErrors: process.env.RUN_CONNECTED_E2E === "1",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ["--no-sandbox"],
        }
      : {},
  },
  webServer: process.env.QA_BASE_URL
    ? undefined
    : {
        command:
          process.env.RUN_CONNECTED_E2E === "1"
            ? "node tests/support/start-connected.mjs"
            : "npm run start -- --port 3100",
        url:
          process.env.RUN_CONNECTED_E2E === "1"
            ? "http://localhost:3400/login"
            : "http://127.0.0.1:3100",
        reuseExistingServer: false,
        timeout: 60000,
      },
});
