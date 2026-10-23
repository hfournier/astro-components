import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, settled } from "./support/helpers";

// FabMenu from the large window size class (1200px) up, where M3's web guidance has the FAB open a
// menu: the cases on /tests/fab-menu, whose FAB is named "Create", now opening a Menu of the same
// items.
type CaseId = "no-props" | "align-start" | "align-end" | "rtl" | "commands";

const menuCase = (page: Page, caseId: CaseId) =>
  page.getByTestId(`fab-menu-${caseId}`);
const fab = (page: Page, caseId: CaseId) =>
  menuCase(page, caseId).getByRole("button", { name: "Create", exact: true });
const menu = (page: Page) =>
  page.getByRole("menu", { name: "Create", exact: true });
const menuItem = (page: Page, name: string) =>
  menu(page).getByRole("menuitem", { name, exact: true });
// the menu's surface, which its placement is measured by
const surface = (page: Page) =>
  menu(page).locator(":scope > [data-ac-wrapper]");

const style = (page: Page, caseId: CaseId, property: string) =>
  fab(page, caseId).evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );

// Scrolls a case's FAB to the bottom of the window, where a page's FAB sits
const fabAtBottom = async (page: Page, caseId: CaseId) => {
  await fab(page, caseId).evaluate((el) =>
    el.scrollIntoView({ block: "end", behavior: "instant" })
  );
};

test.describe("FabMenu in a large window", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/tests/fab-menu");
  });

  test("the FAB opens a menu of its items, named by the FAB, and the Expressive items stay hidden", async ({
    page,
  }) => {
    const toggle = fab(page, "no-props");
    await expect(toggle).toHaveAttribute("aria-haspopup", "menu");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(menu(page)).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute(
      "aria-controls",
      (await menu(page).getAttribute("id"))!
    );
    await expect(menu(page).getByRole("menuitem")).toHaveText([
      "Email",
      "Message",
      "Folder",
    ]);
    await expect(
      menuCase(page, "no-props").getByRole("button", { name: "Email" })
    ).toBeHidden();
    await page.keyboard.press("Escape");
  });

  test("the FAB doesn't morph into a close button, and keeps M3's pressed state layer while open", async ({
    page,
  }) => {
    const toggle = fab(page, "no-props");
    const before = await box(toggle);
    const radius = await style(page, "no-props", "border-top-left-radius");
    const background = await style(page, "no-props", "background-color");
    await toggle.click();
    await settled(page);
    expect(await box(toggle)).toEqual(before);
    expect(await style(page, "no-props", "border-top-left-radius")).toBe(
      radius
    );
    expect(await style(page, "no-props", "background-color")).toBe(background);
    await expect(toggle.locator("svg")).toHaveCount(1);
    await expect
      .poll(() =>
        toggle.evaluate((el) => getComputedStyle(el, "::before").opacity)
      )
      .toBe("0.1");
    await page.keyboard.press("Escape");
  });

  test("the menu's keyboard: it opens on its first item, arrows move, Escape returns focus to the FAB", async ({
    page,
  }) => {
    await fab(page, "no-props").focus();
    await page.keyboard.press("Enter");
    await expect(menuItem(page, "Email")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menuItem(page, "Message")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toBeHidden();
    await expect(fab(page, "no-props")).toBeFocused();

    await page.keyboard.press("ArrowUp");
    await expect(menuItem(page, "Folder")).toBeFocused();
    await page.keyboard.press("Escape");
  });

  test("choosing an item runs the FabMenuItem's own click handler, closes the menu, and returns focus to the FAB", async ({
    page,
  }) => {
    const original = menuCase(page, "no-props").getByRole("button", {
      name: "Message",
      includeHidden: true,
    });
    await original.evaluate((el) =>
      el.addEventListener("click", () => (el.dataset.clicked = "true"))
    );
    await fab(page, "no-props").focus();
    await page.keyboard.press("Enter");
    await menuItem(page, "Message").focus();
    await page.keyboard.press("Enter");
    await expect(original).toHaveAttribute("data-clicked", "true");
    await expect(menu(page)).toBeHidden();
    await expect(fab(page, "no-props")).toBeFocused();
  });

  test("an item's command runs, and a disabled item is disabled in the menu", async ({
    page,
  }) => {
    await fab(page, "commands").click();
    await expect(menuItem(page, "Email")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    await menuItem(page, "Note").click();
    await expect(page.getByText("Note opened")).toBeVisible();
  });

  test("at the bottom of the window, it opens above the FAB, 4px away, lined up with its end edge", async ({
    page,
  }) => {
    await fabAtBottom(page, "align-end");
    await fab(page, "align-end").click();
    await settled(page);
    const button = await box(fab(page, "align-end"));
    const opened = await box(surface(page));
    expect(button.y - (opened.y + opened.height)).toBeCloseTo(4, 0);
    expect(opened.x + opened.width).toBeCloseTo(button.x + button.width, 0);
    await page.keyboard.press("Escape");
  });

  test("with align start, it lines up with the FAB's start edge", async ({
    page,
  }) => {
    await fabAtBottom(page, "align-start");
    await fab(page, "align-start").click();
    await settled(page);
    const button = await box(fab(page, "align-start"));
    const opened = await box(surface(page));
    expect(opened.x).toBeCloseTo(button.x, 0);
    await page.keyboard.press("Escape");
  });

  test("right to left, it lines up with the FAB's left edge", async ({
    page,
  }) => {
    await fabAtBottom(page, "rtl");
    await fab(page, "rtl").click();
    await settled(page);
    const button = await box(fab(page, "rtl"));
    const opened = await box(surface(page));
    expect(opened.x).toBeCloseTo(button.x, 0);
    await page.keyboard.press("Escape");
  });

  test("resizing below 1200px closes the open menu, and the FAB then opens the Expressive items", async ({
    page,
  }) => {
    await fab(page, "no-props").click();
    await expect(menu(page)).toBeVisible();
    await page.setViewportSize({ width: 1199, height: 900 });
    await expect(menu(page)).toBeHidden();
    await fab(page, "no-props").click();
    await expect(
      menuCase(page, "no-props").getByRole("button", { name: "Email" })
    ).toBeVisible();
    await expect(menu(page)).toBeHidden();
    await page.keyboard.press("Escape");
  });

  test("resizing while open moves focus from the menu to the FAB now shown", async ({
    page,
  }) => {
    await fab(page, "no-props").focus();
    await page.keyboard.press("Enter");
    await expect(menuItem(page, "Email")).toBeFocused();
    await page.setViewportSize({ width: 1199, height: 900 });
    await expect(menu(page)).toBeHidden();
    await expect(fab(page, "no-props")).toBeFocused();
  });

  test("resizing to 1200px while closed, the FAB opens the menu, and only one FAB is exposed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1199, height: 900 });
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(
      menuCase(page, "no-props").getByRole("button", { name: "Create" })
    ).toHaveCount(1);
    await fab(page, "no-props").click();
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
