import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun run bun-api/src/index.ts",
      url: "http://localhost:4010/health",
      env: {
        ...process.env,
        API_PORT: "4010",
        MONGODB_URI: "mongodb://127.0.0.1:27018/?replicaSet=rs-e2e&directConnection=true",
        MONGODB_DATABASE: "urbansprout_e2e",
        ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5173",
        MCP_ADMIN_KEY: "e2e-admin-key",
        MCP_SUPPORT_KEY: "e2e-support-key",
        MCP_CLIENT_KEY: "e2e-client-key",
        MCP_CI_KEY: "e2e-ci-key",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev:storefront -- --host 0.0.0.0 --port 3000",
      url: "http://localhost:3000",
      env: {
        ...process.env,
        VITE_E2E: "true",
        VITE_API_URL: "http://localhost:4010",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npm run dev:admin",
      url: "http://localhost:5173",
      env: {
        ...process.env,
        VITE_E2E: "true",
        VITE_API_URL: "http://localhost:4010",
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
