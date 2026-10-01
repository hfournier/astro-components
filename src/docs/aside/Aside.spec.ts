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

// Aside is BaseWrapper with `as` fixed to <aside>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Aside's own: the element it renders and passing props through.
// example-01 renders the only <aside> inside a CodePreview, on surface-container, named "Related reading".
test.describe("Aside", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/aside");
  });

  const aside = (page: Page) =>
    page
      .getByTestId("code-preview")
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
    await expect(target).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );
  });

  test("passes other attributes through, so an aria-label names the landmark", async ({
    page,
  }) => {
    await expect(aside(page)).toHaveAttribute("aria-label", "Related reading");
  });
});
