import type { Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";
import { resolvedColor } from "../../test/helpers";

// Footer is BaseWrapper with `as` fixed to <footer>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Footer's own: the element it renders and passing props through.
// example-01 renders the only <footer> inside a CodePreview, on secondary-container.
test.describe("Footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/footer");
  });

  const footer = (page: Page) =>
    page.getByTestId("code-preview").locator("footer");

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
