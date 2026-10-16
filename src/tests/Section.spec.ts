import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { resolvedColor } from "./support/helpers";

// Section is BaseWrapper with `as` fixed to <section>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Section's own: the element it renders and passing props through.
// The section-background case renders a <section> on surface-container-high. The case is itself a
// Section, so the locator finds the one inside it.
test.describe("Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/section");
  });

  const section = (page: Page) =>
    page.getByTestId("section-background").locator("section");

  test("renders a native <section> and passes bgColor through to BaseWrapper", async ({
    page,
  }) => {
    const target = section(page);

    await expect(target).toHaveJSProperty("tagName", "SECTION");
    await expect(target).not.toHaveAttribute("as");
    await expect(target).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface-container-high)")
    );
  });
});
