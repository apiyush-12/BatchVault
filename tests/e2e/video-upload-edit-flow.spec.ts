import { expect, test } from "@playwright/test";

import { createConfirmedUser, deleteUser, type E2eUser } from "./support/user-fixtures";

/**
 * Core Phase 4B flow (testing.md §7): a member uploads a short video (the
 * poster-frame capture is allowed to fail silently — a fake video buffer
 * cannot be decoded by the browser, which is exactly the "capture failed"
 * path this phase must tolerate without blocking the upload), sees it land
 * in the memory list, then edits their own memory's caption (PRD #7:
 * edit only — there is no delete control anywhere in this phase).
 */

let user: E2eUser;

test.beforeAll(async () => {
  user = await createConfirmedUser();
});

test.afterAll(async () => {
  await deleteUser(user.id);
});

test("a member uploads a short video and edits its caption afterward", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Display name").fill("Video Uploader");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("link", { name: "Create your batch" }).click();
  await page.getByLabel("Batch name").fill("Video Flow Batch");
  await page.getByLabel("Institution").fill("Video Flow University");
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  const batchId = page.url().split("/").pop();

  await page.getByRole("link", { name: "Memories" }).click();
  await page.getByRole("link", { name: "Add" }).click();
  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/upload$`));

  await page.getByRole("link", { name: "Add a short video instead" }).click();
  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/upload/video$`));

  // A tiny, deliberately-fake MP4 buffer. The pipeline's authoritative
  // checks (Storage-observed type/size) never inspect codec/frame data
  // (ADR-08a), so this is valid enough for the upload path itself. The
  // browser cannot decode it into real video metadata, so the client-side
  // poster-frame capture is expected to silently fail here — exactly the
  // "neutral placeholder" path this phase must tolerate.
  await page.getByLabel("Video").setInputFiles({
    name: "memory.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 1, 2, 3, 4]),
  });

  await page.getByLabel("Caption").fill("Our graduation walk");
  await page.getByLabel("Event").fill("Graduation Day");
  await page.getByRole("button", { name: "Add to batch" }).click();

  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/memories$`), { timeout: 20_000 });
  await expect(page.getByText("Our graduation walk")).toBeVisible();
  await expect(page.locator("video")).toBeVisible();

  // Edit: PRD #7 resolved edit-only — there is no delete control to find.
  await page.getByRole("link", { name: "Edit memory" }).click();
  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/memories/[0-9a-f-]{36}/edit$`));

  const captionField = page.getByLabel("Caption");
  await captionField.fill("Our graduation walk — updated");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(new RegExp(`/batches/${batchId}/memories$`), { timeout: 15_000 });
  await expect(page.getByText("Our graduation walk — updated")).toBeVisible();
});
