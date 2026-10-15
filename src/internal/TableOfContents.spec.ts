import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../tests/support/a11y-fixture";
import { box } from "../tests/support/helpers";

const viewportWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.clientWidth);
const isOpen = (sheet: Locator) =>
  sheet.evaluate((el) => (el as HTMLDialogElement).open);

// The docs site's table of contents is a SheetSide: standard and docked from large up, modal
// behind a button below it
test.describe("TableOfContents", () => {
  const docked = (page: Page) =>
    page.getByRole("complementary", { name: "On this page" });
  const modal = (page: Page) => page.locator("#table-of-contents");
  const tocButton = (page: Page) =>
    page.getByRole("button", { name: "Show table of contents" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/components/button");
  });

  test("from large up, it's docked flush to the window's end edge", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { x, width } = await box(docked(page));

    expect(x + width).toBe(await viewportWidth(page));
    await expect(tocButton(page)).toBeHidden();
  });

  test("it's 256px until the article has its full width, then grows to fit its headings", async ({
    page,
  }) => {
    // "Badge with a label over 999" is the longest heading on any page, too long for 256px
    await page.goto("/components/badge");
    const tocWidth = async () => (await box(docked(page))).width;

    await page.setViewportSize({ width: 1200, height: 800 });
    expect(await tocWidth()).toBe(256);

    await page.setViewportSize({ width: 1600, height: 800 });
    await expect.poll(tocWidth).toBeGreaterThan(256);
    expect(await tocWidth()).toBeLessThanOrEqual(400);
  });

  test("below large, its button opens it as a modal, and following a link closes it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 800 });
    await expect(docked(page)).toBeHidden();

    await tocButton(page).click();
    await expect.poll(() => isOpen(modal(page))).toBe(true);
    await modal(page).getByRole("link", { name: "Properties" }).click();

    await expect.poll(() => isOpen(modal(page))).toBe(false);
    await expect(page).toHaveURL(/#properties$/);
  });
});
