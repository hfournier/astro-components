import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor, settled } from "./support/helpers";

// The "submenus" case on /tests/menu: "File" (an outlined Button) opens a grouped menu of New,
// "Open recent" (opening a submenu of Report.pdf and Notes.txt) and Share (with an icon, opening a
// submenu of Email and "Copy link"), then Close in a second group.
const fileTrigger = (page: Page) =>
  page
    .getByTestId("menu-submenus")
    .getByRole("button", { name: "File", exact: true });
const fileMenu = (page: Page) =>
  page.getByRole("menu", { name: "File", exact: true });
const recentMenu = (page: Page) =>
  page.getByRole("menu", { name: "Open recent", exact: true });
const shareMenu = (page: Page) =>
  page.getByRole("menu", { name: "Share", exact: true });
const item = (menu: Locator, name: string) =>
  menu.getByRole("menuitem", { name, exact: true });
const recent = (page: Page) => item(fileMenu(page), "Open recent");
const surface = (menu: Locator) => menu.locator(":scope > [data-ac-wrapper]");
// File's first group, a surface of its own, with the menu's top corners
const firstGroup = (page: Page) =>
  fileMenu(page).locator("[data-ac-menu-group]").first();

const radius = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);

// Opens File from the keyboard and moves to "Open recent"
const focusRecent = async (page: Page) => {
  await fileTrigger(page).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(recent(page)).toBeFocused();
};

test.describe("Menu submenus", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/tests/menu");
  });

  test("the parent item declares its submenu, with a cascading indicator", async ({
    page,
  }) => {
    await focusRecent(page);
    await expect(recent(page)).toHaveAttribute("aria-haspopup", "menu");
    await expect(recent(page)).toHaveAttribute("aria-expanded", "false");
    await expect(recent(page)).toHaveAttribute("aria-controls", "recent-menu");
    const indicator = recent(page).locator("[data-ac-menu-cascading]");
    const { width, height } = await box(indicator);
    expect([width, height]).toEqual([24, 24]);
    await expect(indicator).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
    await page.keyboard.press("Escape");
  });

  test("Enter, Space or a click opens it, focusing its first item, and the parent stays open", async ({
    page,
  }) => {
    await focusRecent(page);
    await page.keyboard.press("Enter");
    await expect(item(recentMenu(page), "Report.pdf")).toBeFocused();
    await expect(recent(page)).toHaveAttribute("aria-expanded", "true");
    await expect(fileMenu(page)).toBeVisible();
    await page.keyboard.press("ArrowLeft");

    await page.keyboard.press(" ");
    await expect(item(recentMenu(page), "Report.pdf")).toBeFocused();
    await page.keyboard.press("ArrowLeft");

    await recent(page).click();
    await expect(item(recentMenu(page), "Report.pdf")).toBeFocused();
    await expect(fileMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  test("ArrowRight opens it and ArrowLeft closes it, returning focus to the parent item", async ({
    page,
  }) => {
    await focusRecent(page);
    await page.keyboard.press("ArrowRight");
    await expect(item(recentMenu(page), "Report.pdf")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(item(recentMenu(page), "Notes.txt")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(recentMenu(page)).toBeHidden();
    await expect(recent(page)).toBeFocused();
    await expect(recent(page)).toHaveAttribute("aria-expanded", "false");
    await expect(fileMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("right to left, ArrowLeft opens it and ArrowRight closes it", async ({
    page,
  }) => {
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    await focusRecent(page);
    await page.keyboard.press("ArrowRight");
    await expect(recentMenu(page)).toBeHidden();
    await page.keyboard.press("ArrowLeft");
    await expect(item(recentMenu(page), "Report.pdf")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(recentMenu(page)).toBeHidden();
    await expect(recent(page)).toBeFocused();
    await page.keyboard.press("Escape");
  });

  test("Escape in it closes only it, returning focus to the parent item", async ({
    page,
  }) => {
    await focusRecent(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await expect(recentMenu(page)).toBeHidden();
    await expect(fileMenu(page)).toBeVisible();
    await expect(recent(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(fileMenu(page)).toBeHidden();
    await expect(fileTrigger(page)).toBeFocused();
  });

  test("choosing an action in it closes every menu, returning focus to the trigger", async ({
    page,
  }) => {
    await focusRecent(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(recentMenu(page)).toBeHidden();
    await expect(fileMenu(page)).toBeHidden();
    await expect(fileTrigger(page)).toBeFocused();
  });

  test("Tab in it closes every menu", async ({ page }) => {
    await focusRecent(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Tab");
    await expect(recentMenu(page)).toBeHidden();
    await expect(fileMenu(page)).toBeHidden();
  });

  test("a click outside closes every menu", async ({ page }) => {
    await focusRecent(page);
    await page.keyboard.press("ArrowRight");
    await page.mouse.click(5, 5);
    await expect(recentMenu(page)).toBeHidden();
    await expect(fileMenu(page)).toBeHidden();
  });

  test("hovering the parent item opens it after a delay, leaving focus in the parent", async ({
    page,
  }) => {
    await fileTrigger(page).click();
    await expect(fileMenu(page)).toBeVisible();
    await recent(page).hover();
    await expect(recentMenu(page)).toBeHidden();
    await expect(recentMenu(page)).toBeVisible();
    await expect(item(fileMenu(page), "New")).toBeFocused();
    // into the submenu, which stays open
    await item(recentMenu(page), "Notes.txt").hover();
    await page.waitForTimeout(500);
    await expect(recentMenu(page)).toBeVisible();
    // onto another item, which closes it
    await item(fileMenu(page), "Close").hover();
    await expect(recentMenu(page)).toBeHidden();
    await expect(fileMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("hovering another parent item opens its submenu in place of the first", async ({
    page,
  }) => {
    await fileTrigger(page).click();
    await recent(page).hover();
    await expect(recentMenu(page)).toBeVisible();
    await item(fileMenu(page), "Share").hover();
    await expect(shareMenu(page)).toBeVisible();
    await expect(recentMenu(page)).toBeHidden();
    await page.keyboard.press("Escape");
  });

  test("it opens beside the parent menu, level with the parent item, without overlapping", async ({
    page,
  }) => {
    await focusRecent(page);
    await page.keyboard.press("ArrowRight");
    await settled(page);
    const parent = await box(surface(fileMenu(page)));
    const parentItem = await box(recent(page));
    const opened = await box(surface(recentMenu(page)));
    expect(opened.x).toBeGreaterThanOrEqual(parent.x + parent.width);
    expect(opened.x - (parent.x + parent.width)).toBeLessThanOrEqual(4.5);
    expect(opened.y).toBeCloseTo(parentItem.y, 0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  test("right to left, it opens on the parent menu's left", async ({
    page,
  }) => {
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    await focusRecent(page);
    await page.keyboard.press("ArrowLeft");
    await settled(page);
    const parent = await box(surface(fileMenu(page)));
    const opened = await box(surface(recentMenu(page)));
    expect(opened.x + opened.width).toBeLessThanOrEqual(parent.x);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  test("the menu with focus has 16px corners, and the other open one 8px", async ({
    page,
  }) => {
    await focusRecent(page);
    expect(await radius(firstGroup(page))).toBe("16px");
    await page.keyboard.press("ArrowRight");
    await settled(page);
    await expect.poll(() => radius(firstGroup(page))).toBe("8px");
    await expect.poll(() => radius(surface(recentMenu(page)))).toBe("16px");
    await page.keyboard.press("ArrowLeft");
    await settled(page);
    await expect.poll(() => radius(firstGroup(page))).toBe("16px");
    await page.keyboard.press("Escape");
  });

  test("the parent item keeps an 8% state layer while its submenu is open", async ({
    page,
  }) => {
    await focusRecent(page);
    await page.keyboard.press("ArrowRight");
    await settled(page);
    await expect
      .poll(() =>
        recent(page).evaluate((el) => getComputedStyle(el, "::before").opacity)
      )
      .toBe("0.08");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });
});
