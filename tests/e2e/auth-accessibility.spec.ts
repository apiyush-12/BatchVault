import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessible forms for the Phase 1 auth/onboarding surfaces (design.md
 * §25–27; phases.md Phase 1 UX deliverables). Onboarding itself needs a
 * signed-in session to reach, so it is covered by the flow spec instead;
 * this covers every page reachable while signed out.
 */

for (const path of ["/sign-up", "/sign-in", "/forgot-password"]) {
  test(`passes an automated accessibility scan: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test("sign-up form errors are associated with their fields", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Create account" }).click();

  const emailInput = page.getByLabel("Email");
  await expect(emailInput).toHaveAttribute("aria-invalid", "true");
  const describedBy = await emailInput.getAttribute("aria-describedby");
  expect(describedBy).not.toBeNull();
});
