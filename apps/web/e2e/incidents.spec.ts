import { expect, test } from "@playwright/test";

import { api, signInWithSetup, TEST_SERVICE } from "./helpers";

test("an alert becomes an incident that can be acknowledged and resolved", async ({ page }) => {
  const { serviceId } = await signInWithSetup(page);

  // Start clean: resolve anything a previous run left open.
  const open = await api<{ data: { id: string; status: string }[] }>(
    page,
    "GET",
    `/incidents?service=${serviceId}&pageSize=50`,
  );
  for (const incident of open.data.data) {
    if (incident.status !== "RESOLVED") {
      await api(page, "POST", `/incidents/${incident.id}/resolve`, {});
    }
  }

  // Send a test alert from the service's page.
  await page.goto(`/services/${serviceId}`);
  await page.getByRole("button", { name: "Send a test alert" }).click();

  // It shows up in the incidents list, waiting for someone.
  await page.goto(`/incidents?service=${serviceId}&status=TRIGGERED`);
  const row = page.getByRole("link").filter({ hasText: `Test alert for ${TEST_SERVICE}` }).first();
  await expect(row).toBeVisible();

  // Acknowledge: the row changes at once, before the list reloads.
  await row.getByRole("button", { name: "Acknowledge" }).click();
  await expect(row.getByRole("button", { name: "Acknowledge" })).toHaveCount(0);
  await expect(row).toContainText("ack'd by E2E Tester");

  // Open it and resolve with the R shortcut.
  await page.goto(`/incidents?service=${serviceId}&status=ACKNOWLEDGED`);
  await page.getByRole("link").filter({ hasText: `Test alert for ${TEST_SERVICE}` }).first().click();
  await page.waitForURL(/\/incidents\/\d+$/);
  await expect(page.getByRole("heading", { name: `Test alert for ${TEST_SERVICE}` })).toBeVisible();

  await page.keyboard.press("r");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Resolve INC-");
  await dialog.getByRole("button", { name: "Resolve" }).click();

  await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Resolve/ })).toHaveCount(0);
});
