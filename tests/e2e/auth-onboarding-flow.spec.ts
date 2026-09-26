import { expect, test } from "@playwright/test";

import { createConfirmedUser, deleteUser, type E2eUser } from "./support/user-fixtures";

/**
 * Core Phase 1 flow (testing.md §7): sign in → onboarding → protected route
 * → logout, plus the standalone "signed-out visitor cannot reach a
 * protected route" case. The sign-up→verify link-click mechanics are
 * covered separately in auth-signup.spec.ts, since a real email inbox isn't
 * available to drive that step end-to-end here.
 */

let user: E2eUser;

test.beforeAll(async () => {
  user = await createConfirmedUser();
});

test.afterAll(async () => {
  await deleteUser(user.id);
});

test("signed-out visitor is redirected away from a protected route", async ({ page }) => {
  const response = await page.goto("/home");
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign in → onboarding → protected route → logout", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // A brand-new confirmed user has no profile yet, so they land on onboarding.
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Complete your profile" }),
  ).toBeVisible();

  await page.getByLabel("Display name").fill("Playwright Test User");
  await page.getByLabel("Bio").fill("Testing the onboarding flow.");
  await page.getByRole("button", { name: "Continue" }).click();

  // Reaches the protected route once onboarding completes. Scoped to the
  // heading specifically — Next.js's own route-announcer live region
  // (#__next-route-announcer__) mirrors this same text for screen readers,
  // so a bare getByText() would ambiguously match both.
  await expect(page).toHaveURL(/\/home$/);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toContainText("Playwright Test User");

  // Onboarding is now gated: revisiting it redirects back to /home.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/home");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  // Signed out: the protected route is unreachable again.
  await page.goto("/home");
  await expect(page).toHaveURL(/\/sign-in$/);
});
