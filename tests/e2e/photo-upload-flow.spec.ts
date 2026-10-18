import { expect, test } from "@playwright/test";

import { createConfirmedUser, deleteUser, type E2eUser } from "./support/user-fixtures";

/**
 * Core Phase 4A flow (testing.md §7, "Upload photo"): a member picks a
 * photo, adds a caption/event/date, watches it upload, and confirms it
 * landed in the batch's "minimal verification list" (architecture §8
 * step 5; phases.md Phase 4A — the real gallery is Phase 5A).
 */

let user: E2eUser;
let batchId: string | undefined;

test.beforeAll(async () => {
  user = await createConfirmedUser();
});

test.afterAll(async () => {
  await deleteUser(user.id);
});

test("a member uploads a photo with a caption and sees it in the batch's memory list", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Photo Uploader");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Create your batch" }).click();
  await page.getByLabel("Batch name").fill("Upload Flow Batch");
  await page.getByLabel("Institution").fill("Upload Flow University");
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  batchId = page.url().split("/").pop();

  await page.getByRole("link", { name: "Memories" }).click();
  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/memories$`));
  await expect(page.getByText("No memories yet")).toBeVisible();

  await page.getByRole("link", { name: "Add" }).click();
  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/upload$`));

  // A tiny, deliberately-fake JPEG buffer — valid enough for a browser File
  // object (Content-Type is explicit, never sniffed) and for the pipeline's
  // own authoritative checks (Storage-observed type/size), which never
  // inspect image structure (architecture §10, ADR-08a). The EXIF-strip
  // step fails safe on bytes it does not recognize (tests/unit/exif.test.ts).
  await page.getByLabel("Photo").setInputFiles({
    name: "memory.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3, 4]),
  });

  await page.getByLabel("Caption").fill("Our farewell dinner");
  await page.getByLabel("Event").fill("Farewell Night");
  await page.getByRole("button", { name: "Add to batch" }).click();

  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/memories$`), { timeout: 15_000 });
  await expect(page.getByText("Our farewell dinner")).toBeVisible();
  await expect(page.getByText("Farewell Night", { exact: false })).toBeVisible();
});
