import { expect, test } from "@playwright/test";

/**
 * Phase 0 smoke test: the production build actually boots and serves the
 * foundation shell (phases.md Phase 0; testing.md §10).
 *
 * There is no product flow to exercise yet, and inventing one here would be
 * a fake finished screen.
 */

test("serves the foundation shell", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/BatchVault/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Foundation" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
});

test("reports no console errors on first load", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  expect(errors).toEqual([]);
});

test("ships no service-role credential to the browser", async ({ page }) => {
  const scripts: string[] = [];
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (type.includes("javascript") || type.includes("html")) {
      scripts.push(await response.text().catch(() => ""));
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  for (const body of scripts) {
    expect(body).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(body).not.toContain("sb_secret_");
    expect(body).not.toContain('"role":"service_role"');
  }
});
