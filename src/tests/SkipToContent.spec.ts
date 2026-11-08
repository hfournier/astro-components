import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";

// BaseLayout renders exactly one SkipToContent, as the first element in <body>,
// on every page - the homepage has no other instance competing for the name. Its
// name is exactly the default text, so a broken fallback fails every test below.
const skipLink = (page: Page) =>
  page.getByRole("link", { name: "Skip to content", exact: true });

// Color/contrast is Button's own concern now that SkipToContent composes <Button as="a">
// (#46) - Button.spec.ts covers it (including the text-white regression #45 caught). This
// file keeps only what's actually SkipToContent's own behavior.
test.describe("SkipToContent", () => {
  test.describe("in BaseLayout", () => {
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

  // A page in another language words the link in its default slot
  test("takes its text from its default slot", async ({ page }) => {
    await page.goto("/tests/skip-to-content");
    const link = page
      .getByTestId("skip-to-content-labels")
      .getByRole("link", { name: "Aller au contenu", exact: true });
    await expect(link).toHaveAttribute("href", "#main-content");
    await link.focus();
    await expect(link).toBeInViewport();
  });
});
