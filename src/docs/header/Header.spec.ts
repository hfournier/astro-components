import type { Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

async function resolvedColor(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.color = value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssValue);
}

// Header is BaseWrapper with `as` fixed to <header>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Header's own: the element it renders and passing props through.
// example-01 renders the only <header> inside a CodePreview, on primary-container.
test.describe("Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/header");
  });

  const header = (page: Page) =>
    page.getByTestId("code-preview").locator("header");

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
    await expect(target).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-primary-container)")
    );
  });
});
