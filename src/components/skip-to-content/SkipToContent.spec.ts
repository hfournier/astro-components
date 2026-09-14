import type { Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

// BaseLayout renders exactly one SkipToContent, as the first element in <body>,
// on every page - the homepage has no other instance competing for the name.
const skipLink = (page: Page) =>
  page.getByRole("link", { name: "Skip to content" });

// Color/contrast is Button's own concern now that SkipToContent composes <Button as="a">
// (#46) - Button.spec.ts covers it (including the text-white regression #45 caught). This
// file keeps only what's actually SkipToContent's own behavior.
test.describe("SkipToContent", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("targets #main-content by default", async ({ page }) => {
    await expect(skipLink(page)).toHaveAttribute("href", "#main-content");
  });

  test("is off-screen until focused, then becomes visible and passes contrast", async ({
    page,
  }) => {
    await expect(skipLink(page)).not.toBeInViewport();

    await skipLink(page).focus();
    await expect(skipLink(page)).toBeInViewport();
    // The a11y fixture's automatic axe scan (ADR-0002) runs after this test body,
    // while the link is still focused/visible, catching any contrast violation.
  });
});
