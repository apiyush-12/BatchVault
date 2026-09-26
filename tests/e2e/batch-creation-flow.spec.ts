import { expect, test } from "@playwright/test";

import { createConfirmedUser, deleteUser, type E2eUser } from "./support/user-fixtures";

/**
 * Core Phase 2 flow (testing.md §7, "Create batch"): an onboarded user
 * creates a batch, lands on its home page as owner, sees themselves in the
 * roster, and can reach and save batch settings (admin+ — they're the
 * owner). No invites/join flow yet (Phase 3A), so this is the whole loop
 * Phase 2 promises: create → view → configure.
 */

let user: E2eUser;

test.beforeAll(async () => {
  user = await createConfirmedUser();
});

test.afterAll(async () => {
  await deleteUser(user.id);
});

async function signInAndOnboard(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Batch Creator");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test("create a batch, land on its home page as owner, appear in the roster, and edit settings", async ({
  page,
}) => {
  await signInAndOnboard(page);

  // No batch yet: /home shows the empty state with the create CTA. (The
  // rendered apostrophe is U+2019, from JSX's &rsquo;, not ASCII U+0027.)
  await expect(page.getByText(/not part of a batch yet/)).toBeVisible();
  await page.getByRole("link", { name: "Create your batch" }).click();
  await expect(page).toHaveURL(/\/batches\/new$/);

  await page.getByLabel("Batch name").fill("Playwright Batch");
  await page.getByLabel("Institution").fill("Playwright University");
  await page.getByRole("button", { name: "Create batch" }).click();

  // create_batch redirects straight into the new batch (security.md §5.2.1).
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Playwright Batch" })).toBeVisible();
  await expect(page.getByText("🔒 Private")).toBeVisible();

  const batchUrl = page.url();

  // The batch switcher on /home now lists it.
  await page.goto("/home");
  await expect(page.getByRole("link", { name: /Playwright Batch/ })).toBeVisible();

  // Roster shows exactly the owner.
  await page.goto(`${batchUrl}/members`);
  await expect(page.getByText("Batch Creator")).toBeVisible();
  await expect(page.getByText("owner")).toBeVisible();

  // Owner is admin+, so settings is reachable and a change persists
  // (update_batch_settings, audited — security.md §11, §20).
  await page.goto(`${batchUrl}/settings`);
  await expect(page.getByLabel("Batch name")).toHaveValue("Playwright Batch");
  await page.getByLabel("Batch name").fill("Playwright Batch (renamed)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto(batchUrl);
  await expect(
    page.getByRole("heading", { level: 1, name: "Playwright Batch (renamed)" }),
  ).toBeVisible();
});

test("a page for a batch that does not exist shows the generic not-available state", async ({
  page,
}) => {
  await signInAndOnboard(page);

  await page.goto("/batches/00000000-0000-0000-0000-000000000000");
  await expect(page.getByText(/Can.t show this/)).toBeVisible();
});
