import { expect, test } from "@playwright/test";

import { createConfirmedUser, deleteUser, type E2eUser } from "./support/user-fixtures";

/**
 * Phase 8B lifecycle (PRD #6; security.md B3, R4): an owner deletes their
 * batch, restores it from /home, is refused account deletion while still
 * owning it, deletes it again, and then deletes their account.
 */

let user: E2eUser;

test.beforeAll(async () => {
  user = await createConfirmedUser();
});

test.afterAll(async () => {
  // Normally already gone (the test deletes the account); tolerate both.
  await deleteUser(user.id).catch(() => undefined);
});

test("delete and restore a batch, then delete the account", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Lifecycle Owner");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Create your batch" }).click();
  await page.getByLabel("Batch name").fill("Lifecycle Batch");
  await page.getByLabel("Institution").fill("Lifecycle University");
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  const batchId = page.url().split("/").pop();

  const deleteBatch = async () => {
    await page.goto(`/batches/${batchId}/settings`);
    const confirm = page.getByLabel(/to confirm/);
    await confirm.fill("lifecycle batch");
    await expect(page.getByRole("button", { name: "Delete batch" })).toBeDisabled();
    await confirm.fill("Lifecycle Batch");
    await page.getByRole("button", { name: "Delete batch" }).click();
    await expect(page).toHaveURL(/\/home$/);
  };

  await deleteBatch();
  await expect(page.getByRole("heading", { name: "Scheduled for deletion" })).toBeVisible();
  await page.goto(`/batches/${batchId}`);
  await expect(page.getByText(/Can.t show this/)).toBeVisible();

  await page.goto("/home");
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("link", { name: /Lifecycle Batch/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scheduled for deletion" })).toHaveCount(0);

  // Still the owner of a live batch: account deletion is refused (B3).
  await page.goto("/settings");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "You own a batch" })).toBeVisible();

  await deleteBatch();

  await page.goto("/settings");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/sign-in$/, { timeout: 20_000 });

  // The account is really gone: signing in again fails.
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("alert").first()).toBeVisible();
});
