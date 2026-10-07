import { defineConfig } from "@playwright/test";

// Browser tests for the paths that matter most. They need the app already
// running (pnpm dev at the repository root), and they use their own test
// organization, never yours. See e2e/helpers.ts.
export default defineConfig({
  testDir: "./e2e",
  // One at a time: the tests share one test organization.
  workers: 1,
  timeout: 90 * 1000,
  // A hosted database can take a few seconds to answer.
  expect: { timeout: 15 * 1000 },
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
});
