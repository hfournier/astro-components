import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { resolvedColor } from "./support/helpers";

// Aside is BaseWrapper with `as` fixed to <aside>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Aside's own: the element it renders and passing props through.
// The aside-background-and-label case renders an <aside> on surface-container, named "Related reading".
test.describe("Aside", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/aside");
  });

  const aside = (page: Page) =>
    page
      .getByTestId("aside-background-and-label")
      .getByRole("complementary", { name: "Related reading" });

  test("renders a native <aside> and passes bgColor through to BaseWrapper", async ({
    page,
  }) => {
    const target = aside(page);

    await expect(target).toHaveJSProperty("tagName", "ASIDE");
    await expect(target).not.toHaveAttribute("as");
    await expect(target).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface-container)")
    );
  });

  test("passes other attributes through, so an aria-label names the landmark", async ({
    page,
  }) => {
    await expect(aside(page)).toHaveAttribute("aria-label", "Related reading");
  });
});
