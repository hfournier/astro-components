import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, settled } from "./support/helpers";

// The "context" case on /tests/menu: a focusable "Photo" box (#context-target) with a context menu,
// "Photo actions", of "Copy image", "Save image" and Delete. A paragraph, "Elsewhere", follows it.
const target = (page: Page) => page.locator("#context-target");
const contextMenu = (page: Page) =>
  page.getByRole("menu", { name: "Photo actions", exact: true });
const item = (page: Page, name: string) =>
  contextMenu(page).getByRole("menuitem", { name, exact: true });
const surface = (page: Page) =>
  contextMenu(page).locator(":scope > [data-ac-wrapper]");

// Records whether each contextmenu event reaching the document was prevented, so the browser's own
// menu would or wouldn't show
const watchBrowserMenu = (page: Page) =>
  page.evaluate(() => {
    const log: boolean[] = [];
    (window as unknown as { prevented: boolean[] }).prevented = log;
    document.addEventListener("contextmenu", (event) =>
      log.push(event.defaultPrevented)
    );
  });
const prevented = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { prevented: boolean[] }).prevented
  );

test.describe("Menu context menus", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/tests/menu");
    await target(page).scrollIntoViewIfNeeded();
  });

  test("a right-click on the target opens it at the pointer, in place of the browser's", async ({
    page,
  }) => {
    await watchBrowserMenu(page);
    const area = await box(target(page));
    const x = area.x + 40;
    const y = area.y + 30;
    await page.mouse.click(x, y, { button: "right" });
    await expect(contextMenu(page)).toBeVisible();
    await settled(page);
    const opened = await box(surface(page));
    // within a pixel, as WebKit rounds the point
    expect(Math.abs(opened.x - x)).toBeLessThanOrEqual(1);
    expect(Math.abs(opened.y - y)).toBeLessThanOrEqual(1);
    await expect(item(page, "Copy image")).toBeFocused();
    expect(await prevented(page)).toEqual([true]);
    await page.keyboard.press("Escape");
  });

  test("Shift+F10 on the target opens it at the target's start edge, focusing the first item", async ({
    page,
  }) => {
    await target(page).focus();
    await page.keyboard.press("Shift+F10");
    await expect(item(page, "Copy image")).toBeFocused();
    await settled(page);
    const area = await box(target(page));
    const opened = await box(surface(page));
    expect(opened.x).toBeCloseTo(area.x, 0);
    expect(opened.y).toBeCloseTo(area.y, 0);
    await page.keyboard.press("Escape");
  });

  test("the Menu key on the target opens it", async ({ page }) => {
    await target(page).focus();
    await page.keyboard.press("ContextMenu");
    await expect(item(page, "Copy image")).toBeFocused();
    await page.keyboard.press("Escape");
  });

  test("Escape closes it, returning focus to the target", async ({ page }) => {
    await target(page).focus();
    await page.keyboard.press("Shift+F10");
    await expect(contextMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(contextMenu(page)).toBeHidden();
    await expect(target(page)).toBeFocused();
  });

  test("choosing an item closes it, returning focus to the target", async ({
    page,
  }) => {
    await target(page).focus();
    await page.keyboard.press("Shift+F10");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(contextMenu(page)).toBeHidden();
    await expect(target(page)).toBeFocused();
  });

  test("a right-click elsewhere leaves the browser's menu", async ({
    page,
  }) => {
    await watchBrowserMenu(page);
    await page.locator("#context-elsewhere").click({ button: "right" });
    await expect(contextMenu(page)).toBeHidden();
    expect(await prevented(page)).toEqual([false]);
  });

  test("Shift + right-click, or a second right-click while it's open, shows the browser's menu", async ({
    page,
  }) => {
    await watchBrowserMenu(page);
    // Firefox shows its own menu on Shift + right-click without firing the event at all
    await target(page).click({ button: "right", modifiers: ["Shift"] });
    await expect(contextMenu(page)).toBeHidden();
    expect(await prevented(page)).not.toContain(true);

    await watchBrowserMenu(page);
    await target(page).click({ button: "right" });
    await expect(contextMenu(page)).toBeVisible();
    await target(page).click({ button: "right" });
    await expect(contextMenu(page)).toBeHidden();
    expect(await prevented(page)).toEqual([true, false]);
  });

  test("near the window's right edge, it opens leftward from the pointer", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.reload();
    await target(page).scrollIntoViewIfNeeded();
    const area = await box(target(page));
    const x = area.x + area.width - 10;
    expect(360 - x).toBeLessThan(112);
    await page.mouse.click(x, area.y + 30, { button: "right" });
    await expect(contextMenu(page)).toBeVisible();
    await settled(page);
    const opened = await box(surface(page));
    expect(Math.abs(opened.x + opened.width - x)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
  });
});
