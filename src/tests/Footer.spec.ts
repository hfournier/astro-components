import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { resolvedColor } from "./support/helpers";

// Footer is BaseWrapper with `as` fixed to <footer>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Footer's own: the element it renders and passing props through.
// The footer-background case renders a <footer> on secondary-container. Keep the case scope: the
// site layout has its own <footer>, on the same role.
test.describe("Footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/footer");
  });

  const footer = (page: Page) =>
    page.getByTestId("footer-background").locator("footer");

  test("renders a native <footer> and passes bgColor through to BaseWrapper", async ({
    page,
  }) => {
    const target = footer(page);

    await expect(target).toHaveJSProperty("tagName", "FOOTER");
    await expect(target).not.toHaveAttribute("as");
    await expect(target).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-secondary-container)")
    );
  });
});
