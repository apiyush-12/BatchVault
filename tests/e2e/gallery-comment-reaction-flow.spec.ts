import { expect, test } from "@playwright/test";

import { createConfirmedUser, deleteUser, type E2eUser } from "./support/user-fixtures";

/**
 * COMPLETION-FIRST session: the one focused happy-path E2E covering the
 * major newly-built flow — a member uploads a photo, opens it from the real
 * paginated gallery (Phase 5A), comments on it and reacts to it (Phase 6).
 */

let user: E2eUser;

test.beforeAll(async () => {
  user = await createConfirmedUser();
});

test.afterAll(async () => {
  await deleteUser(user.id);
});

test("a member opens a memory from the gallery, comments, and reacts", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Gallery Tester");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Create your batch" }).click();
  await page.getByLabel("Batch name").fill("Gallery Flow Batch");
  await page.getByLabel("Institution").fill("Gallery Flow University");
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  const batchId = page.url().split("/").pop();

  await page.getByRole("link", { name: "Memories" }).click();
  await page.getByRole("link", { name: "Add" }).click();
  await page.getByLabel("Photo").setInputFiles({
    name: "memory.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3, 4]),
  });
  await page.getByLabel("Caption").fill("Gallery test photo");
  await page.getByRole("button", { name: "Add to batch" }).click();

  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/memories$`), { timeout: 20_000 });

  // Open the memory from the real gallery grid.
  await page.getByText("Gallery test photo").click();
  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/memories/[0-9a-f-]{36}$`));

  // React.
  await page.getByRole("button", { name: /love/ }).click();

  // Comment.
  await page.getByLabel("Write a comment").fill("What a day!");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText("What a day!")).toBeVisible();
});
