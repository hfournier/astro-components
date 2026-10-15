import type { Page } from "@playwright/test";
import { test, expect } from "../../tests/support/a11y-fixture";
import { box, resolvedColor } from "../../tests/support/helpers";

test.describe("Divider", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/divider");
  });

  // DOM order inside the CodePreviews: the usage example's divider, example-01's three
  // horizontal insets (none, start, middle), then example-02's two vertical dividers (none,
  // middle). The source block beside each preview is highlighted text, not elements.
  const dividers = (page: Page) =>
    page.getByTestId("code-preview").locator("hr");

  test("renders M3's 1px outline-variant line on a native <hr>", async ({
    page,
  }) => {
    const divider = dividers(page).first();

    await expect(divider).toHaveRole("separator");
    await expect(divider).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-outline-variant)")
    );
    expect((await box(divider)).height).toBe(1);
  });

  test("inset start leaves 16px before the line, middle 16px at both ends", async ({
    page,
  }) => {
    const [none, start, middle] = [1, 2, 3].map((i) => dividers(page).nth(i));
    const full = await box(none);

    const startBox = await box(start);
    expect(startBox.x - full.x).toBe(16);
    expect(full.x + full.width - (startBox.x + startBox.width)).toBe(0);

    const middleBox = await box(middle);
    expect(middleBox.x - full.x).toBe(16);
    expect(full.x + full.width - (middleBox.x + middleBox.width)).toBe(16);
  });

  test("a vertical divider is a 1px line stretched to its row, and inset middle shortens both ends", async ({
    page,
  }) => {
    const vertical = dividers(page).nth(4);
    const insetMiddle = dividers(page).nth(5);
    const rowHeight = await vertical.evaluate(
      (el) => el.parentElement!.clientHeight
    );

    await expect(vertical).toHaveAttribute("aria-orientation", "vertical");
    expect((await box(vertical)).width).toBe(1);
    expect((await box(vertical)).height).toBe(rowHeight);
    expect((await box(insetMiddle)).height).toBe(rowHeight - 32);
  });
});
