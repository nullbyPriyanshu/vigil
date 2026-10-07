import { expect, test } from "@playwright/test";

import { signInWithSetup, TEST_USER } from "./helpers";

test("the login form signs you in and lands on the dashboard", async ({ page, context }) => {
  // Make sure the account exists, then start again signed out.
  await signInWithSetup(page);
  await context.clearCookies();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await page.getByPlaceholder("you@example.com").fill(TEST_USER.email);
  await page.getByPlaceholder("Enter your password").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), E2E/ })).toBeVisible();
});

test("a wrong password is refused with a message", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(TEST_USER.email);
  await page.getByPlaceholder("Enter your password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("signup and forgot-password pages show their forms", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByPlaceholder("Acme Corp")).toBeVisible();
  await expect(page.getByPlaceholder("At least 8 characters")).toBeVisible();

  await page.goto("/forgot-password");
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
});

test("a signed-out visitor is sent to the login page", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
