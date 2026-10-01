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

// Section is BaseWrapper with `as` fixed to <section>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Section's own: the element it renders and passing props through.
// example-01 renders one Section per background role, each labelled by a <code> with the role's name.
test.describe("Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/section");
  });

  const section = (page: Page) =>
    page
      .getByTestId("code-preview")
      .locator("section")
      .filter({
        has: page.locator("code", { hasText: /^surface-container-high$/ }),
      });

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
    await expect(target).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );
  });

  test("renders one Section per background role", async ({ page }) => {
    await expect(
      page.getByTestId("code-preview").locator("section")
    ).toHaveCount(18);
  });
});
