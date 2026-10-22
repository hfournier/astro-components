import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  castsNoShadow,
  expectFocusRing,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/menu is a Section with data-testid="menu-<caseId>", holding a trigger and the
// Menu it opens:
// - actions: "Edit" (an outlined Button) opens a grouped, standard-color menu. Its first group has
//   no label: Copy (trailing text "Ctrl+C"), Rename, and Share (supporting text). Its second,
//   "More", has Download (a badge of 3), Settings (a link to #settings), Delete (disabled) and
//   Print (no icon). A text Button, "After the trigger", follows the trigger.
// - standard-layout: "More options" (a ButtonIcon) opens a standard-layout menu: Copy and Share,
//   then Delete in a second group.
// - selection: "Format" opens a vibrant menu. "Style" holds checkbox items Bold (checked) and
//   Italic, both name "style"; "Align" holds radio items Left (checked), Center and Right
//   (disabled), name "align".
// - standard-checked: "View" opens a standard-color menu labelled "View options" by its `label`,
//   with checkbox items "Show hidden files" (checked, with an icon) and "Show extensions".
type MenuCaseId =
  "actions" | "standard-layout" | "selection" | "standard-checked";

const triggerNames: Record<MenuCaseId, string> = {
  actions: "Edit",
  "standard-layout": "More options",
  selection: "Format",
  "standard-checked": "View",
};
const menuNames: Record<MenuCaseId, string> = {
  actions: "Edit",
  "standard-layout": "More options",
  selection: "Format",
  "standard-checked": "View options",
};

const trigger = (page: Page, caseId: MenuCaseId) =>
  page
    .getByTestId(`menu-${caseId}`)
    .getByRole("button", { name: triggerNames[caseId], exact: true });
const menu = (page: Page, caseId: MenuCaseId) =>
  page.getByRole("menu", { name: menuNames[caseId], exact: true });
const item = (page: Page, caseId: MenuCaseId, name: string) =>
  menu(page, caseId).getByRole("menuitem", { name, exact: true });
const checkbox = (page: Page, caseId: MenuCaseId, name: string) =>
  menu(page, caseId).getByRole("menuitemcheckbox", { name, exact: true });
const radio = (page: Page, name: string) =>
  menu(page, "selection").getByRole("menuitemradio", { name, exact: true });
// The surfaces: each group's in the grouped layout
const groups = (page: Page, caseId: MenuCaseId) =>
  menu(page, caseId).locator("[data-ac-menu-group]");
// The menu's own surface, inside the popover
const surface = (page: Page, caseId: MenuCaseId) =>
  menu(page, caseId).locator(":scope > [data-ac-wrapper]");

const open = async (page: Page, caseId: MenuCaseId) => {
  await trigger(page, caseId).click();
  await expect(menu(page, caseId)).toBeVisible();
  await settled(page);
};

const radii = (target: Locator) =>
  target.evaluate((el) => {
    const style = getComputedStyle(el);
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ];
  });

const changes = (page: Page, caseId: MenuCaseId) =>
  page.evaluate((id) => {
    const log: unknown[] = [];
    (window as unknown as { menuChanges: unknown[] }).menuChanges = log;
    document
      .querySelector(`#${id}`)!
      .addEventListener("change", (event) =>
        log.push((event as CustomEvent).detail)
      );
  }, `${caseId}-menu`);
const changeLog = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { menuChanges: unknown[] }).menuChanges
  );

test.describe("Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/menu");
  });

  test.describe("roles and names", () => {
    test("the trigger declares the menu it opens and whether it's open", async ({
      page,
    }) => {
      const button = trigger(page, "actions");
      await expect(button).toHaveAttribute("aria-haspopup", "menu");
      await expect(button).toHaveAttribute("aria-controls", "actions-menu");
      await expect(button).toHaveAttribute("aria-expanded", "false");

      await open(page, "actions");
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(button).toHaveAttribute("aria-expanded", "false");
    });

    test("the menu is named by its trigger, or by its label", async ({
      page,
    }) => {
      await open(page, "actions");
      await expect(menu(page, "actions")).toBeVisible();
      await page.keyboard.press("Escape");

      await open(page, "standard-checked");
      await expect(menu(page, "standard-checked")).toBeVisible();
    });

    test("items are menuitems, named by their label and any badge count; groups are named by their label", async ({
      page,
    }) => {
      await open(page, "actions");
      for (const name of [
        "Copy",
        "Rename",
        "Share",
        "Download, 3",
        "Settings",
        "Delete",
        "Print",
      ])
        await expect(item(page, "actions", name)).toBeVisible();
      await expect(
        menu(page, "actions").getByRole("group", { name: "More" })
      ).toBeVisible();
      await expect(item(page, "actions", "Settings")).toHaveAttribute(
        "href",
        "#settings"
      );
      await expect(item(page, "actions", "Delete")).toHaveAttribute(
        "aria-disabled",
        "true"
      );
      // supporting text describes its item
      await expect(item(page, "actions", "Share")).toHaveAccessibleDescription(
        "With people or apps"
      );
    });

    test("checkbox and radio items have aria-checked", async ({ page }) => {
      await open(page, "selection");
      await expect(checkbox(page, "selection", "Bold")).toHaveAttribute(
        "aria-checked",
        "true"
      );
      await expect(checkbox(page, "selection", "Italic")).toHaveAttribute(
        "aria-checked",
        "false"
      );
      await expect(radio(page, "Left")).toHaveAttribute("aria-checked", "true");
      await expect(radio(page, "Center")).toHaveAttribute(
        "aria-checked",
        "false"
      );
    });
  });

  test.describe("keyboard", () => {
    test("Enter on the trigger opens it, focusing the first item", async ({
      page,
    }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("Enter");
      await expect(item(page, "actions", "Copy")).toBeFocused();
    });

    test("Space on the trigger opens it, focusing the first item", async ({
      page,
    }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press(" ");
      await expect(item(page, "actions", "Copy")).toBeFocused();
    });

    test("ArrowDown and ArrowUp on the trigger open it on the first and last item", async ({
      page,
    }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      await expect(item(page, "actions", "Copy")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(trigger(page, "actions")).toBeFocused();

      await page.keyboard.press("ArrowUp");
      await expect(item(page, "actions", "Print")).toBeFocused();
    });

    test("ArrowDown and ArrowUp move through every item, disabled ones too, wrapping", async ({
      page,
    }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      for (const name of [
        "Rename",
        "Share",
        "Download, 3",
        "Settings",
        "Delete",
        "Print",
        "Copy",
      ]) {
        await page.keyboard.press("ArrowDown");
        await expect(item(page, "actions", name)).toBeFocused();
      }
      await page.keyboard.press("ArrowUp");
      await expect(item(page, "actions", "Print")).toBeFocused();
    });

    test("Home and End move to the first and last item", async ({ page }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("End");
      await expect(item(page, "actions", "Print")).toBeFocused();
      await page.keyboard.press("Home");
      await expect(item(page, "actions", "Copy")).toBeFocused();
    });

    test("a letter moves to the next item whose label starts with it", async ({
      page,
    }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("d");
      await expect(item(page, "actions", "Download, 3")).toBeFocused();
      await page.keyboard.press("d");
      await expect(item(page, "actions", "Delete")).toBeFocused();
      await page.keyboard.press("s");
      await expect(item(page, "actions", "Share")).toBeFocused();
    });

    test("the items are one Tab stop, focused by script", async ({ page }) => {
      await open(page, "actions");
      const tabIndexes = await menu(page, "actions")
        .locator("[role^=menuitem]")
        .evaluateAll((items) => items.map((el) => el.getAttribute("tabindex")));
      expect(new Set(tabIndexes)).toEqual(new Set(["-1"]));
    });

    test("Escape closes it, returning focus to the trigger", async ({
      page,
    }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Escape");
      await expect(menu(page, "actions")).toBeHidden();
      await expect(trigger(page, "actions")).toBeFocused();
    });

    test("Tab closes it, and focus moves on from the trigger", async ({
      page,
    }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Tab");
      await expect(menu(page, "actions")).toBeHidden();
      await expect(
        page
          .getByTestId("menu-actions")
          .getByRole("button", { name: "After the trigger" })
      ).toBeFocused();
    });

    test("Enter on a disabled item doesn't activate it or close the menu", async ({
      page,
    }) => {
      await page.evaluate(() => {
        (window as unknown as { deleted: boolean }).deleted = false;
        document
          .querySelector("#actions-menu [aria-disabled=true]")!
          .addEventListener(
            "click",
            () => ((window as unknown as { deleted: boolean }).deleted = true)
          );
      });
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowUp");
      await expect(item(page, "actions", "Delete")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(menu(page, "actions")).toBeVisible();
      expect(
        await page.evaluate(
          () => (window as unknown as { deleted: boolean }).deleted
        )
      ).toBe(false);
    });

    test("Space activates a link item", async ({ page }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("s");
      await page.keyboard.press("s");
      await expect(item(page, "actions", "Settings")).toBeFocused();
      await page.keyboard.press(" ");
      await expect(page).toHaveURL(/#settings$/);
      await expect(menu(page, "actions")).toBeHidden();
    });
  });

  test.describe("closing", () => {
    test("an action item runs its click and closes, returning focus to the trigger", async ({
      page,
    }) => {
      await page.evaluate(() => {
        (window as unknown as { renamed: boolean }).renamed = false;
        document
          .querySelectorAll("#actions-menu [role=menuitem]")[1]!
          .addEventListener(
            "click",
            () => ((window as unknown as { renamed: boolean }).renamed = true)
          );
      });
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(menu(page, "actions")).toBeHidden();
      await expect(trigger(page, "actions")).toBeFocused();
      expect(
        await page.evaluate(
          () => (window as unknown as { renamed: boolean }).renamed
        )
      ).toBe(true);
    });

    test("a click outside closes it", async ({ page }) => {
      await open(page, "actions");
      await page
        .getByTestId("menu-actions")
        .getByRole("heading", { name: "Actions" })
        .click();
      await expect(menu(page, "actions")).toBeHidden();
    });

    test("a checkbox item toggles, fires change and stays open", async ({
      page,
    }) => {
      await changes(page, "selection");
      await open(page, "selection");
      await checkbox(page, "selection", "Italic").click();
      await expect(checkbox(page, "selection", "Italic")).toHaveAttribute(
        "aria-checked",
        "true"
      );
      await expect(menu(page, "selection")).toBeVisible();
      await checkbox(page, "selection", "Bold").click();
      await expect(checkbox(page, "selection", "Bold")).toHaveAttribute(
        "aria-checked",
        "false"
      );
      expect(await changeLog(page)).toEqual([
        { name: "style", value: "italic", checked: true },
        { name: "style", value: "bold", checked: false },
      ]);
    });

    test("a radio item checks itself, unchecks its group's others, fires change and closes", async ({
      page,
    }) => {
      await changes(page, "selection");
      await open(page, "selection");
      await radio(page, "Center").click();
      await expect(menu(page, "selection")).toBeHidden();
      await open(page, "selection");
      await expect(radio(page, "Center")).toHaveAttribute(
        "aria-checked",
        "true"
      );
      await expect(radio(page, "Left")).toHaveAttribute(
        "aria-checked",
        "false"
      );
      // the checkboxes, in another group, are untouched
      await expect(checkbox(page, "selection", "Bold")).toHaveAttribute(
        "aria-checked",
        "true"
      );
      expect(await changeLog(page)).toEqual([
        { name: "align", value: "center", checked: true },
      ]);
      // closed again, so axe doesn't read the next case's trigger through it
      await page.keyboard.press("Escape");
    });

    test("a disabled radio item doesn't check", async ({ page }) => {
      await open(page, "selection");
      // forced, as Playwright won't click an aria-disabled element
      await radio(page, "Right").click({ force: true });
      await expect(radio(page, "Right")).toHaveAttribute(
        "aria-checked",
        "false"
      );
      await expect(menu(page, "selection")).toBeVisible();
    });
  });

  test.describe("specs", () => {
    test("standard: surface-container-low groups at elevation 2, 2px apart, with M3's grouped corners", async ({
      page,
    }) => {
      await open(page, "actions");
      const [first, second] = [
        groups(page, "actions").nth(0),
        groups(page, "actions").nth(1),
      ];
      const lowColor = await resolvedColor(
        page,
        "var(--theme-color-surface-container-low)"
      );
      for (const group of [first, second]) {
        await expect(group).toHaveCSS("background-color", lowColor);
        expect(await castsNoShadow(group)).toBe(false);
      }
      const firstBox = await box(first);
      const secondBox = await box(second);
      expect(secondBox.y - (firstBox.y + firstBox.height)).toBeCloseTo(2, 0);
      expect(await radii(first)).toEqual(["16px", "16px", "8px", "8px"]);
      expect(await radii(second)).toEqual(["8px", "8px", "16px", "16px"]);
    });

    test("is 112px to 280px wide, as wide as its widest item", async ({
      page,
    }) => {
      await open(page, "actions");
      const { width } = await box(surface(page, "actions"));
      expect(width).toBeGreaterThanOrEqual(112);
      expect(width).toBeLessThanOrEqual(280);
      const share = await box(item(page, "actions", "Share"));
      const copy = await box(item(page, "actions", "Copy"));
      expect(copy.width).toBeCloseTo(share.width, 0);
      // 4px in from the surface at each side
      expect(
        copy.x - (await box(groups(page, "actions").first())).x
      ).toBeCloseTo(4, 0);
    });

    test("items are at least 44px high, in Label Large, with 20px icons and M3's item corners", async ({
      page,
    }) => {
      await open(page, "actions");
      const copy = item(page, "actions", "Copy");
      expect((await box(copy)).height).toBeGreaterThanOrEqual(44);
      await expect(copy).toHaveCSS("font-size", "14px");
      await expect(copy).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface)")
      );
      const icon = copy.locator("svg").first();
      expect((await box(icon)).width).toBe(20);
      await expect(icon).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface-variant)")
      );
      // the first item in a group has 12px top corners, a middle one 4px, the last 12px bottom ones
      expect(await radii(copy)).toEqual(["12px", "12px", "4px", "4px"]);
      expect(await radii(item(page, "actions", "Rename"))).toEqual([
        "4px",
        "4px",
        "4px",
        "4px",
      ]);
      expect(await radii(item(page, "actions", "Share"))).toEqual([
        "4px",
        "4px",
        "12px",
        "12px",
      ]);
    });

    test("an item without an icon keeps the icon's space, so labels line up", async ({
      page,
    }) => {
      await open(page, "actions");
      const label = (name: string) =>
        item(page, "actions", name).locator("[data-ac-menu-label]");
      expect((await box(label("Print"))).x).toBeCloseTo(
        (await box(label("Copy"))).x,
        0
      );
    });

    test("trailing text, a badge and supporting text", async ({ page }) => {
      await open(page, "actions");
      const copy = item(page, "actions", "Copy");
      const trailing = copy.getByText("Ctrl+C", { exact: true });
      // at the item's end, 16px in
      expect(
        (await box(copy)).x +
          (await box(copy)).width -
          ((await box(trailing)).x + (await box(trailing)).width)
      ).toBeCloseTo(16, 0);
      await expect(trailing).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface-variant)")
      );
      await expect(
        item(page, "actions", "Download, 3").getByText("3", { exact: true })
      ).toBeVisible();
      const supporting = item(page, "actions", "Share").getByText(
        "With people or apps"
      );
      await expect(supporting).toHaveCSS("font-size", "12px");
    });

    test("a disabled item's content is at 38%", async ({ page }) => {
      await open(page, "actions");
      await expect(
        item(page, "actions", "Delete").locator("[data-ac-menu-label]")
      ).toHaveCSS("opacity", "0.38");
    });

    test("the focus ring is drawn inset", async ({ page }) => {
      await trigger(page, "actions").focus();
      await page.keyboard.press("ArrowDown");
      await expectFocusRing(item(page, "actions", "Copy"), { inset: true });
    });

    test("the standard layout is one 16px-cornered surface, with an inset divider between groups", async ({
      page,
    }) => {
      await open(page, "standard-layout");
      const menuSurface = surface(page, "standard-layout");
      await expect(menuSurface).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
      expect(await radii(menuSurface)).toEqual([
        "16px",
        "16px",
        "16px",
        "16px",
      ]);
      const second = groups(page, "standard-layout").nth(1);
      const divider = await second.evaluate((el) => {
        const style = getComputedStyle(el, "::before");
        return {
          display: style.display,
          borderTopWidth: style.borderTopWidth,
          borderTopColor: style.borderTopColor,
          marginInline: [style.marginLeft, style.marginRight],
          marginBlock: [style.marginTop, style.marginBottom],
        };
      });
      expect(divider).toEqual({
        display: "block",
        borderTopWidth: "1px",
        borderTopColor: await resolvedColor(
          page,
          "var(--theme-color-outline-variant)"
        ),
        marginInline: ["12px", "12px"],
        marginBlock: ["2px", "2px"],
      });
      // no divider above the first group
      expect(
        await groups(page, "standard-layout")
          .nth(0)
          .evaluate((el) => getComputedStyle(el, "::before").display)
      ).toBe("none");
    });

    test("vibrant: tertiary-container, with on-tertiary-container content; checked, tertiary with on-tertiary and 12px corners", async ({
      page,
    }) => {
      await open(page, "selection");
      await expect(groups(page, "selection").first()).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-tertiary-container)")
      );
      const italic = checkbox(page, "selection", "Italic");
      await expect(italic).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-tertiary-container)")
      );
      const bold = checkbox(page, "selection", "Bold");
      await expect(bold).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-tertiary)")
      );
      await expect(bold).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-tertiary)")
      );
      expect(await radii(bold)).toEqual(["12px", "12px", "12px", "12px"]);
      // a checked item shows a check as its leading icon; an unchecked one doesn't
      await expect(bold.locator("[data-ac-menu-check]")).toBeVisible();
      await expect(italic.locator("[data-ac-menu-check]")).toBeHidden();
    });

    test("standard, checked: tertiary-container with on-tertiary-container, the check replacing the icon", async ({
      page,
    }) => {
      await open(page, "standard-checked");
      const shown = checkbox(page, "standard-checked", "Show hidden files");
      await expect(shown).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-tertiary-container)")
      );
      await expect(shown).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-tertiary-container)")
      );
      await expect(shown.locator("[data-ac-menu-check]")).toBeVisible();
      await expect(shown.locator("[data-ac-menu-icon]")).toBeHidden();
      // no groups, so the menu is one surface
      await expect(surface(page, "standard-checked")).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
    });

    test("the open menu's trigger shows its pressed state layer", async ({
      page,
    }) => {
      const layer = (target: Locator) =>
        target.evaluate((el) => getComputedStyle(el, "::before").opacity);
      await open(page, "standard-layout");
      await page.mouse.move(0, 0);
      await expect
        .poll(() => layer(trigger(page, "standard-layout")))
        .toBe("0.1");
      await page.keyboard.press("Escape");
      await open(page, "actions");
      await page.mouse.move(0, 0);
      await expect.poll(() => layer(trigger(page, "actions"))).toBe("0.1");
    });
  });

  test.describe("placement", () => {
    test("below the trigger, 4px away, lined up with its start edge", async ({
      page,
    }) => {
      await open(page, "actions");
      const button = await box(trigger(page, "actions"));
      const opened = await box(surface(page, "actions"));
      expect(opened.y - (button.y + button.height)).toBeCloseTo(4, 0);
      expect(opened.x).toBeCloseTo(button.x, 0);
    });

    test("above the trigger when there's no room below", async ({ page }) => {
      // a short window, scrolled so it ends 40px below the trigger, less than the menu's height
      await page.setViewportSize({ width: 1280, height: 400 });
      const roomBelow = await trigger(page, "standard-checked").evaluate(
        (el) => {
          window.scrollBy(
            0,
            el.getBoundingClientRect().bottom - (innerHeight - 40)
          );
          return innerHeight - el.getBoundingClientRect().bottom;
        }
      );
      expect(roomBelow).toBeCloseTo(40, 0);
      // from the keyboard, as a click first scrolls the trigger to where Playwright wants it
      await trigger(page, "standard-checked").focus();
      await page.keyboard.press("Enter");
      await expect(menu(page, "standard-checked")).toBeVisible();
      await settled(page);
      const button = await box(trigger(page, "standard-checked"));
      const opened = await box(menu(page, "standard-checked"));
      expect(button.y - (opened.y + opened.height)).toBeCloseTo(4, 0);
    });

    test("right to left, lined up with the trigger's right edge", async ({
      page,
    }) => {
      await page.evaluate(() => (document.documentElement.dir = "rtl"));
      await open(page, "actions");
      const button = await box(trigger(page, "actions"));
      const opened = await box(surface(page, "actions"));
      expect(opened.x + opened.width).toBeCloseTo(button.x + button.width, 0);
    });
  });
});
