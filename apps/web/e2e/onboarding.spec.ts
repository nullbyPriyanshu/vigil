import { expect, test } from "@playwright/test";

import { api } from "./helpers";

// A brand-new person: sign up, log in, walk through the setup wizard and
// land on a dashboard with their first incident. The account and its
// organization are deleted again at the end.
test("a new signup is walked through setup to a working dashboard", async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const stamp = Date.now();
  const person = {
    name: "New Person",
    email: `delivered+onboarding${stamp}@resend.dev`,
    password: "Vigil@onboard-12345",
    organizationName: `Onboarding ${stamp}`,
  };

  await page.goto("/signup");
  await page.getByPlaceholder("Alex Smith").fill(person.name);
  await page.getByPlaceholder("Acme Corp").fill(person.organizationName);
  await page.getByPlaceholder("you@example.com").fill(person.email);
  await page.getByPlaceholder("At least 8 characters").fill(person.password);
  await page.getByRole("button", { name: /create|sign up/i }).click();

  await page.waitForURL("**/login");
  await page.getByPlaceholder("you@example.com").fill(person.email);
  await page.getByPlaceholder("Enter your password").fill(person.password);
  await page.getByRole("button", { name: "Log in" }).click();

  try {
    // Nothing is set up yet, so the dashboard hands over to the wizard.
    await page.waitForURL("**/onboarding");

    await page.getByLabel("Team name").fill("Platform");
    await page.screenshot({ path: "test-results/onboarding-1-team.png" });
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Service name").fill("Checkout API");
    await page.screenshot({ path: "test-results/onboarding-2-service.png" });
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByLabel("Hand over every Monday at")).toBeVisible();
    await page.screenshot({ path: "test-results/onboarding-3-schedule.png" });
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("button", { name: "Send a test alert" })).toBeVisible();
    await page.screenshot({ path: "test-results/onboarding-4-test.png" });
    await page.getByRole("button", { name: "Send a test alert" }).click();

    // The wizard confirms the incident, then hands over to the dashboard.
    await expect(page.getByText(/INC-\d+ is open/)).toBeVisible();
    await page.getByRole("button", { name: "Go to the dashboard" }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByText("Test alert for Checkout API").first()).toBeVisible();
  } finally {
    // Nobody else is in the organization, so deleting the account takes
    // the organization with it.
    const gone = await api(page, "DELETE", "/user/profile", { currentPassword: person.password });
    expect(gone.status, JSON.stringify(gone.data)).toBe(200);
  }
});
