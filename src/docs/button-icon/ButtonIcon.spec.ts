import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../tests/support/a11y-fixture";
import { box } from "../../tests/support/helpers";

// Every live ButtonIcon on /components/button-icon sits inside a CodePreview
// (data-testid="code-preview"); the source block beside each preview is highlighted text, not
// real controls. Each button's accessible name is its `label`.
const buttons = (page: Page, name: string) =>
  page.getByTestId("code-preview").getByRole("button", { name, exact: true });

const size = async (target: Locator) => {
  const { width, height } = await box(target);
  return { width, height };
};

// The icon showing: with a selectedIcon, both icons render and CSS hides one
const visibleIcons = (target: Locator) => target.locator("svg:visible");

test.describe("ButtonIcon", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/button-icon");
  });

  test("defaults to a 40px round button, type=button, named by its label", async ({
    page,
  }) => {
    const usage = buttons(page, "Settings");

    await expect(usage).toHaveAttribute("type", "button");
    await expect(usage).toHaveAttribute("aria-label", "Settings");
    await expect(usage).not.toHaveAttribute("aria-pressed");
    expect(await size(usage)).toEqual({ width: 40, height: 40 });
    await expect(usage).toHaveCSS("border-top-left-radius", "20px");
  });

  test("each size is M3's height, with a touch target of at least 48px", async ({
    page,
  }) => {
    // example-02: xs, sm, md, lg, xl
    const heights = [32, 40, 56, 96, 136];
    const favorite = buttons(page, "Favorite");

    for (const [i, height] of heights.entries()) {
      const button = favorite.nth(i);
      expect(await size(button)).toEqual({ width: height, height });
      const target = await button.evaluate((el) => {
        const style = getComputedStyle(el, "::after");
        return [parseFloat(style.width), parseFloat(style.height)];
      });
      // the ::after fills at least the padding box (inside the border) of the larger sizes
      expect(target[0]).toBeGreaterThanOrEqual(48);
      expect(target[1]).toBeGreaterThanOrEqual(48);
    }
  });

  test("shape sets round or square corners, and width narrow, default or wide", async ({
    page,
  }) => {
    // example-03 at size md: round, square, then narrow, default and wide
    const share = buttons(page, "Share");

    await expect(share.nth(0)).toHaveCSS("border-top-left-radius", "28px");
    await expect(share.nth(1)).toHaveCSS("border-top-left-radius", "16px");
    expect((await size(share.nth(2))).width).toBe(48);
    expect((await size(share.nth(3))).width).toBe(56);
    expect((await size(share.nth(4))).width).toBe(72);
  });

  test("a toggle flips aria-pressed on click and from the keyboard, swapping its icon", async ({
    page,
  }) => {
    // example-04: four toggles starting unselected, then four starting selected
    const bookmark = buttons(page, "Bookmark");
    const toggle = bookmark.first();

    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    const unselectedIcon = await visibleIcons(toggle).innerHTML();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(visibleIcons(toggle)).toHaveCount(1);
    expect(await visibleIcons(toggle).innerHTML()).not.toBe(unselectedIcon);

    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(await visibleIcons(toggle).innerHTML()).toBe(unselectedIcon);

    await expect(bookmark.nth(4)).toHaveAttribute("aria-pressed", "true");
  });

  test("a selected round toggle turns square", async ({ page }) => {
    const toggle = buttons(page, "Bookmark").first();

    await expect(toggle).toHaveCSS("border-top-left-radius", "20px");
    await toggle.click();
    // the corners transition, so poll
    await expect(toggle).toHaveCSS("border-top-left-radius", "12px");
  });

  test("shows its label as a plain tooltip on hover, hidden from assistive tech", async ({
    page,
  }) => {
    const usage = buttons(page, "Settings");
    const tooltip = usage.locator("[data-ac-tooltip]");

    await expect(tooltip).toHaveText("Settings");
    await expect(tooltip).toHaveAttribute("aria-hidden", "true");
    await expect(tooltip).toBeHidden();

    await usage.hover();
    await expect(tooltip).toBeVisible();
  });
});
