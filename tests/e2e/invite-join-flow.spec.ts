import { expect, test } from "@playwright/test";

import { createConfirmedUser, deleteUser, type E2eUser } from "./support/user-fixtures";

/**
 * Core Phase 3A flow (testing.md §7, "Create/share invite" + "Redeem →
 * join, or → pending approval"): an owner creates a batch, generates an
 * invite link, and a second, not-yet-signed-in person redeems it and lands
 * in the batch — the first real multi-member moment in the product.
 */

let owner: E2eUser;
let joiner: E2eUser;
let batchId: string | undefined;

test.beforeAll(async () => {
  [owner, joiner] = await Promise.all([createConfirmedUser(), createConfirmedUser()]);
});

test.afterAll(async () => {
  await Promise.all([deleteUser(owner.id), deleteUser(joiner.id)]);
});

async function signIn(
  page: import("@playwright/test").Page,
  user: E2eUser,
): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("owner creates an invite link; an unauthenticated recipient signs in and joins", async ({
  page,
}) => {
  // --- Owner: create a batch that auto-approves joins, then an invite link.
  await signIn(page, owner);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Invite Owner");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Create your batch" }).click();
  await page.getByLabel("Batch name").fill("Invite Flow Batch");
  await page.getByLabel("Institution").fill("Invite Flow University");
  await page.getByLabel("Who can join").selectOption("invite_only_auto_approve");
  await page.getByRole("button", { name: "Create batch" }).click();

  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  batchId = page.url().split("/").pop();

  await page.getByRole("link", { name: "Invite classmates" }).click();
  await expect(page).toHaveURL(/\/invite$/);
  await page.getByRole("button", { name: "Create invite link" }).click();

  await expect(
    page.getByText(/Share this link with your classmates/),
  ).toBeVisible();
  const inviteUrl = await page.locator("code").innerText();
  expect(inviteUrl).toContain("/invite#");
  // Navigate relative to Playwright's own baseURL rather than the literal
  // origin in NEXT_PUBLIC_SITE_URL, which may differ from the test server's
  // port — only the path and fragment matter for this test.
  const relativeInviteUrl = new URL(inviteUrl).pathname + new URL(inviteUrl).hash;

  await page.goto("/home");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  // --- Joiner: not signed in yet, follows the raw invite link.
  await page.goto(relativeInviteUrl);
  await expect(page.getByText(/You.re invited/)).toBeVisible();
  await expect(page.getByText("Invite Flow Batch")).toBeVisible();

  // The visible URL no longer carries the raw token (security.md §9.1).
  expect(page.url()).not.toContain("#");

  await page.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email").fill(joiner.email);
  await page.getByLabel("Password").fill(joiner.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Invite Joiner");
  await page.getByRole("button", { name: "Continue" }).click();

  // /home resumes the pending redemption automatically (no token in any URL).
  await expect(page).toHaveURL(/\/invite$/);
  await page.getByRole("button", { name: "Join" }).click();

  // Auto-approve policy: redemption lands the joiner straight in the batch.
  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: "Invite Flow Batch" }),
  ).toBeVisible();

  await page.goto(`/batches/${batchId}/members`);
  await expect(page.getByText("Invite Owner")).toBeVisible();
  await expect(page.getByText("Invite Joiner")).toBeVisible();
});

test("an invalid invite link shows one generic, indistinguishable message", async ({ page }) => {
  await page.goto("/invite#this-token-was-never-issued");
  await expect(page.getByText(/Can.t show this/)).toBeVisible();
  expect(page.url()).not.toContain("#");
});
