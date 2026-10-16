import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { resolvedColor } from "./support/helpers";

// Header is BaseWrapper with `as` fixed to <header>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Header's own: the element it renders and passing props through.
// The header-background case renders a <header> on primary-container. Keep the case scope: the
// site layout has its own <header>, on the same role.
test.describe("Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/header");
  });

  const header = (page: Page) =>
    page.getByTestId("header-background").locator("header");

  test("renders a native <header> and passes bgColor through to BaseWrapper", async ({
    page,
  }) => {
    const target = header(page);

    await expect(target).toHaveJSProperty("tagName", "HEADER");
    await expect(target).not.toHaveAttribute("as");
    await expect(target).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-primary-container)")
    );
  });
});
