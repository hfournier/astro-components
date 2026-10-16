import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box } from "./support/helpers";

// Each case on /tests/button-icon is a Section with data-testid="button-icon-<caseId>". Each
// button's accessible name is its `label`, which names the size, shape or width it shows.
type ButtonIconCaseId =
  "no-props" | "sizes" | "shapes" | "widths" | "toggle" | "toggle-selected";

const button = (page: Page, caseId: ButtonIconCaseId, name: string) =>
  page
    .getByTestId(`button-icon-${caseId}`)
    .getByRole("button", { name, exact: true });

const size = async (target: Locator) => {
  const { width, height } = await box(target);
  return { width, height };
};

// The icon showing: with a selectedIcon, both icons render and CSS hides one
const visibleIcons = (target: Locator) => target.locator("svg:visible");

test.describe("ButtonIcon", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/button-icon");
  });

  test("defaults to a 40px round button, type=button, named by its label", async ({
    page,
  }) => {
    const usage = button(page, "no-props", "Settings");

    await expect(usage).toHaveAttribute("type", "button");
    await expect(usage).toHaveAttribute("aria-label", "Settings");
    await expect(usage).not.toHaveAttribute("aria-pressed");
    expect(await size(usage)).toEqual({ width: 40, height: 40 });
    await expect(usage).toHaveCSS("border-top-left-radius", "20px");
  });

  test("each size is M3's height, with a touch target of at least 48px", async ({
    page,
  }) => {
    const heights = { xs: 32, sm: 40, md: 56, lg: 96, xl: 136 };

    for (const [name, height] of Object.entries(heights)) {
      const target = button(page, "sizes", `Favorite ${name}`);
      expect(await size(target)).toEqual({ width: height, height });
      const touchTarget = await target.evaluate((el) => {
        const style = getComputedStyle(el, "::after");
        return [parseFloat(style.width), parseFloat(style.height)];
      });
      // the ::after fills at least the padding box (inside the border) of the larger sizes
      expect(touchTarget[0]).toBeGreaterThanOrEqual(48);
      expect(touchTarget[1]).toBeGreaterThanOrEqual(48);
    }
  });

  test("shape sets round or square corners, and width narrow, default or wide", async ({
    page,
  }) => {
    // all at size md
    await expect(button(page, "shapes", "Share round")).toHaveCSS(
      "border-top-left-radius",
      "28px"
    );
    await expect(button(page, "shapes", "Share square")).toHaveCSS(
      "border-top-left-radius",
      "16px"
    );
    expect((await size(button(page, "widths", "Share narrow"))).width).toBe(48);
    expect((await size(button(page, "widths", "Share default"))).width).toBe(
      56
    );
    expect((await size(button(page, "widths", "Share wide"))).width).toBe(72);
  });

  test("a toggle flips aria-pressed on click and from the keyboard, swapping its icon", async ({
    page,
  }) => {
    const toggle = button(page, "toggle", "Bookmark");

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

    await expect(button(page, "toggle-selected", "Bookmark")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("a selected round toggle turns square", async ({ page }) => {
    const toggle = button(page, "toggle", "Bookmark");

    await expect(toggle).toHaveCSS("border-top-left-radius", "20px");
    await toggle.click();
    // the corners transition, so poll
    await expect(toggle).toHaveCSS("border-top-left-radius", "12px");
  });

  test("shows its label as a plain tooltip on hover, hidden from assistive tech", async ({
    page,
  }) => {
    const usage = button(page, "no-props", "Settings");
    const tooltip = usage.locator("[data-ac-tooltip]");

    await expect(tooltip).toHaveText("Settings");
    await expect(tooltip).toHaveAttribute("aria-hidden", "true");
    await expect(tooltip).toBeHidden();

    await usage.hover();
    await expect(tooltip).toBeVisible();
  });
});
