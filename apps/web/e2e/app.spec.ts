import { expect, test } from "@playwright/test";

import { api, signInWithSetup } from "./helpers";

test("a service can be created from the services page", async ({ page }) => {
  await signInWithSetup(page);
  const name = `E2E temp ${Date.now()}`;

  await page.goto("/services");
  await page.getByRole("button", { name: "New service" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Checkout API").fill(name);
  await dialog.locator("#service-team").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "Add service" }).click();

  await expect(page.getByText(name)).toBeVisible();

  // Tidy up: this service has no incidents, so it can simply be deleted.
  const services = await api<{ data: { id: string; name: string }[] }>(page, "GET", "/services");
  const created = services.data.data.find((s) => s.name === name);
  if (created) await api(page, "DELETE", `/services/${created.id}`);
});

test("the notification switch saves and can be switched back", async ({ page }) => {
  await signInWithSetup(page);
  await page.goto("/settings/profile");

  const toggle = page.getByRole("switch", { name: "Email me when I'm paged" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await toggle.click();
  await expect(page.getByText("Incident emails turned off")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  await toggle.click();
  await expect(page.getByText("Incident emails turned on")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
});

test("keyboard shortcuts: ? lists them, G then I goes to incidents", async ({ page }) => {
  await signInWithSetup(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Good/ })).toBeVisible();

  await page.keyboard.press("?");
  await expect(page.getByRole("dialog")).toContainText("Keyboard shortcuts");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.keyboard.press("g");
  await page.keyboard.press("i");
  await page.waitForURL("**/incidents");
});

test("the about page and footer link are public", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Hi, I'm Priyanshu." })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Vigil on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/nullbyPriyanshu/vigil",
  );
});

test("a monitor can be added, shows as up, and is refused for a private address", async ({ page }) => {
  await signInWithSetup(page);
  const name = `E2E site ${Date.now()}`;

  await page.goto("/monitors");
  await page.getByRole("button", { name: /New monitor|Add your first monitor/ }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.locator("#monitor-service").click();
  await page.getByRole("option").first().click();

  // The server must never be pointed at its own network.
  await dialog.getByLabel("Address to check").fill("http://127.0.0.1:5432");
  await dialog.getByRole("button", { name: "Add monitor" }).click();
  await expect(dialog.getByText(/private network/)).toBeVisible();

  // A real public address is checked straight away.
  await dialog.getByLabel("Address to check").fill("https://example.com");
  await dialog.getByRole("button", { name: "Add monitor" }).click();
  await expect(dialog).toHaveCount(0);

  const row = page.getByRole("link").filter({ hasText: name });
  await expect(row).toContainText("Up");

  // The detail page has its figures, and the monitor can be removed.
  await row.click();
  await expect(page.getByText("Uptime, last 30 days")).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();

  const monitors = await api<{ data: { id: string; name: string }[] }>(page, "GET", "/monitors");
  const created = monitors.data.data.find((m) => m.name === name);
  if (created) await api(page, "DELETE", `/monitors/${created.id}`);
});
