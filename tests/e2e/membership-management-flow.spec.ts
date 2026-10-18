import { expect, test } from "@playwright/test";

import { createConfirmedUser, deleteUser, type E2eUser } from "./support/user-fixtures";

/**
 * Core Phase 3B flow (testing.md §7, "Membership approval" + "Role change"):
 * an owner approves a pending join request, promotes the new member to
 * moderator, then removes them — the first real membership-decision moment
 * in the product.
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

async function signIn(page: import("@playwright/test").Page, user: E2eUser): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("owner approves a pending request, promotes the member, then removes them", async ({
  page,
}) => {
  // --- Owner: create a batch (default join policy requires approval).
  await signIn(page, owner);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Membership Owner");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Create your batch" }).click();
  await page.getByLabel("Batch name").fill("Membership Flow Batch");
  await page.getByLabel("Institution").fill("Membership Flow University");
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  batchId = page.url().split("/").pop();

  await page.getByRole("link", { name: "Invite classmates" }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  const inviteUrl = await page.locator("code").innerText();
  const relativeInviteUrl = new URL(inviteUrl).pathname + new URL(inviteUrl).hash;

  await page.goto("/home");
  await page.getByRole("button", { name: "Sign out" }).click();

  // --- Joiner: redeem into the pending queue (requires_approval default).
  await page.goto(relativeInviteUrl);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email").fill(joiner.email);
  await page.getByLabel("Password").fill(joiner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Membership Joiner");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/invite$/);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("Request sent")).toBeVisible();

  await page.goto("/home");
  await page.getByRole("button", { name: "Sign out" }).click();

  // --- Owner: approve the pending request.
  await signIn(page, owner);
  await expect(page).toHaveURL(/\/home$/);
  await page.goto(`/batches/${batchId}/members`);

  await expect(page.getByRole("heading", { name: "Waiting for approval" })).toBeVisible();
  await expect(page.getByText("Membership Joiner")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByRole("heading", { name: "Waiting for approval" })).toBeHidden();
  const joinerRow = page.getByText("Membership Joiner").locator("..").locator("..");
  await expect(joinerRow.getByText("member", { exact: true })).toBeVisible();

  // --- Owner: promote the new member to moderator.
  await joinerRow.getByLabel(/Change Membership Joiner's role/).selectOption("moderator");
  await expect(joinerRow.getByText("moderator", { exact: true })).toBeVisible();

  // --- Owner: remove the member (window.confirm must be accepted).
  page.once("dialog", (dialog) => dialog.accept());
  await joinerRow.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Membership Joiner")).toBeHidden();
});
