import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Foundation accessibility behaviour (design.md §25–29; testing.md §2.6).
 *
 * Phase 0 ships one placeholder screen, so this covers the foundations every
 * later screen inherits: automated scanning, skip-to-content, a visible focus
 * indicator distinct from hover, and reduced-motion rendering.
 */

test("passes an automated accessibility scan", async ({ page }) => {
  await page.goto("/");

  // Contrast is measured on the settled UI. Sampling a half-faded entrance
  // frame measures the animation, not the design tokens.
  await expect(page.locator('[data-motion="entrance"]')).toHaveCSS(
    "opacity",
    "1",
  );

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("offers skip-to-content as the first keyboard stop", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("renders a visible focus indicator", async ({ page }) => {
  await page.goto("/");

  const themeButton = page.getByRole("button", { name: "Use dark theme" });
  await themeButton.focus();

  const outline = await themeButton.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      width: style.outlineWidth,
      style: style.outlineStyle,
      offset: style.outlineOffset,
    };
  });

  expect(outline.style).not.toBe("none");
  expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
});

test("renders its content under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  // Reduced motion swaps the animation for an instant equivalent; it never
  // removes the content (design.md §29).
  await expect(
    page.getByRole("heading", { level: 1, name: "Foundation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toHaveCSS("opacity", "1");
});

test("honours an explicit theme override", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // "System" removes the override entirely, so the OS preference decides.
  await page.getByRole("button", { name: "Match system theme" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
});
