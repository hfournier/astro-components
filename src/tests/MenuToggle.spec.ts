import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box } from "./support/helpers";

// The menu-toggle-no-props case on /tests/menu-toggle holds one MenuToggle. Keep the case scope:
// the site's own rail has another, outside it.
const toggle = (page: Page) =>
  page
    .getByTestId("menu-toggle-no-props")
    .getByRole("button", { name: "Menu", exact: true });

// MenuToggle renders both icons, and CSS shows the one for its state
const visibleIcon = (target: Locator) => target.locator("svg:visible");

test.describe("MenuToggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/menu-toggle");
  });

  test("is a 56px disclosure button, collapsed to start with", async ({
    page,
  }) => {
    const button = toggle(page);
    const { width, height } = await box(button);

    expect({ width, height }).toEqual({ width: 56, height: 56 });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).not.toHaveAttribute("aria-pressed");
  });

  test("flips aria-expanded on click and from the keyboard, swapping its icon", async ({
    page,
  }) => {
    const button = toggle(page);
    const collapsedIcon = await visibleIcon(button).innerHTML();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(visibleIcon(button)).toHaveCount(1);
    expect(await visibleIcon(button).innerHTML()).not.toBe(collapsedIcon);

    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    expect(await visibleIcon(button).innerHTML()).toBe(collapsedIcon);
  });
});
