import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, css, radii, resolvedColor, settled } from "./support/helpers";

// Each case on /tests/list is a Section with data-testid="list-<caseId>". A segmented List is a
// group: its items sit 2px apart, each filled, with 16px corners at the group's ends.
type SegmentedCaseId = "segmented" | "segmented-selection" | "segmented-rtl";

const scope = (page: Page, caseId: SegmentedCaseId) =>
  page.getByTestId(`list-${caseId}`);
// the item's container, the <li>'s first child: a <div>, <a>, <button> or <label>
const items = (list: Locator) =>
  list.locator(":scope > li > [data-ac-list-item]");
// the first group, of every layout, and the group of one after it
const everyLayout = (page: Page) =>
  scope(page, "segmented").getByRole("list", { name: /^Segmented/ });
const yesterday = (page: Page) =>
  scope(page, "segmented").getByRole("list", { name: "Yesterday" });
const all = (radius: string) => [radius, radius, radius, radius];

test.describe("List segmented", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/list");
  });

  // M3's Guidelines: "Use segmented gaps and filled list items to define a list group". Compose's
  // SegmentedGap is 2dp.
  test("its items sit 2px apart, in a list that's still a list", async ({
    page,
  }) => {
    const list = everyLayout(page);
    await expect(list).toHaveJSProperty("tagName", "UL");
    const rows = await items(list).all();
    expect(rows).toHaveLength(6);
    for (let i = 1; i < rows.length; i++) {
      const above = await box(rows[i - 1]!);
      const below = await box(rows[i]!);
      expect(below.y - (above.y + above.height)).toBeCloseTo(2, 0);
    }
  });

  // M3's Specs draw segmented items in surface-container on a surface page, in light and dark, as
  // Compose's samples fill them; the text keeps on-surface (ADR-0029)
  for (const scheme of ["light", "dark"] as const) {
    test(`its items are filled in surface-container, in ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const container = await resolvedColor(
        page,
        "var(--theme-color-surface-container)"
      );
      const onSurface = await resolvedColor(
        page,
        "var(--theme-color-on-surface)"
      );
      for (const name of ["Ali Connors", "Watering basics"]) {
        const item = items(everyLayout(page)).filter({ hasText: name });
        expect(await css(item, "background-color")).toBe(container);
        expect(await css(item, "color")).toBe(onSurface);
      }
      // a standard list's items stay on surface
      const standard = page
        .getByTestId("list-one-line")
        .locator("[data-ac-list-item]")
        .first();
      expect(await css(standard, "background-color")).toBe(
        await resolvedColor(page, "var(--theme-color-surface)")
      );
    });
  }

  // M3's Specs: "Unselected corner radius: 4dp inner, 16dp outer". Compose's segmentedShapes
  // rounds the first item's top corners and the last one's bottom ones, and all four of an only
  // item's.
  test("its group is rounded 16px at its ends and 4px between items", async ({
    page,
  }) => {
    const list = items(everyLayout(page));
    expect(await radii(list.first())).toEqual(["16px", "16px", "4px", "4px"]);
    expect(await radii(list.nth(2))).toEqual(all("4px"));
    expect(await radii(list.last())).toEqual(["4px", "4px", "16px", "16px"]);
    expect(await radii(items(yesterday(page)).first())).toEqual(all("16px"));
  });

  // Compose's state shapes replace the segmented one: 12px hovered, 16px focused or pressed, and
  // 16px selected, all around
  test("hovered, focused and selected items morph all four corners", async ({
    page,
  }) => {
    const first = items(everyLayout(page)).first();
    await first.hover();
    await settled(page);
    expect(await radii(first)).toEqual(all("12px"));

    const plant = items(everyLayout(page)).nth(1);
    await page.keyboard.press("Tab");
    while (!(await first.evaluate((el) => el === document.activeElement)))
      await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowDown");
    await expect(plant).toBeFocused();
    await page.mouse.move(0, 0);
    await settled(page);
    expect(await radii(plant)).toEqual(all("16px"));

    // the checked checkbox item is selected
    const pin = items(everyLayout(page)).nth(3);
    expect(await radii(pin)).toEqual(all("16px"));
    expect(await css(pin, "background-color")).toBe(
      await resolvedColor(page, "var(--theme-color-secondary-container)")
    );
  });

  // The segmented style is a visual choice and doesn't change a list's behavior (M3's Specs):
  // each layout keeps its standard heights
  test("each layout keeps its height", async ({ page }) => {
    const list = items(everyLayout(page));
    // two lines with an avatar (72px); a 56px image and its padding (76px); three lines with an
    // overline and a video (88px); one line with a checkbox (56px)
    expect((await box(list.nth(0))).height).toBeCloseTo(72, 0);
    expect((await box(list.nth(1))).height).toBeCloseTo(76, 0);
    expect((await box(list.nth(2))).height).toBeCloseTo(88, 0);
    expect((await box(list.nth(3))).height).toBeCloseTo(56, 0);
  });

  // M3's Specs draw a multi-select segmented list with two selected items next to each other:
  // each its own 16px highlight, the gap between them
  test("selected items next to each other stay separate highlights", async ({
    page,
  }) => {
    const toppings = items(
      scope(page, "segmented-selection").getByRole("list", { name: "Toppings" })
    );
    const highlight = await resolvedColor(
      page,
      "var(--theme-color-secondary-container)"
    );
    for (const i of [0, 1]) {
      expect(await radii(toppings.nth(i))).toEqual(all("16px"));
      expect(await css(toppings.nth(i), "background-color")).toBe(highlight);
    }
    const basil = await box(toppings.nth(0));
    const olives = await box(toppings.nth(1));
    expect(olives.y - (basil.y + basil.height)).toBeCloseTo(2, 0);
    // the unselected last item keeps the group's end
    expect(await radii(toppings.last())).toEqual([
      "4px",
      "4px",
      "16px",
      "16px",
    ]);
  });

  test("radio items, a trailing icon and wrapping supporting text keep their layout", async ({
    page,
  }) => {
    const section = scope(page, "segmented-selection");
    const crust = items(section.getByRole("list", { name: "Crust" }));
    expect(await radii(crust.first())).toEqual(all("16px"));
    expect(await radii(crust.nth(1))).toEqual(all("4px"));
    expect(await radii(crust.last())).toEqual(["4px", "4px", "16px", "16px"]);
    // a one-line item is 56px, and supporting text that wraps makes three lines, 88px
    expect((await box(crust.last())).height).toBeCloseTo(56, 0);
    const anchovies = items(
      section.getByRole("list", { name: "Toppings" })
    ).last();
    await expect(anchovies).toHaveAttribute("data-ac-list-item-lines", "3");
    expect((await box(anchovies)).height).toBeGreaterThanOrEqual(88);
    // the arrow keys move the radio selection, as in a standard list
    await section.getByRole("radio", { name: "Thin" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(
      section.getByRole("radio", { name: "Deep dish" })
    ).toBeChecked();
    // deselected, Thin morphs back to the group's corners
    await settled(page);
    expect(await radii(crust.first())).toEqual(["16px", "16px", "4px", "4px"]);
  });

  test("mirrors right to left", async ({ page }) => {
    const list = items(
      scope(page, "segmented-rtl").getByRole("list", { name: "الإعدادات" })
    );
    const network = list.first();
    const icon = network.locator("[data-ac-list-item-part=leading]");
    const itemBox = await box(network);
    const iconBox = await box(icon);
    // the leading icon sits 16px from the item's right edge
    expect(itemBox.x + itemBox.width - (iconBox.x + iconBox.width)).toBeCloseTo(
      16,
      0
    );
    expect(await radii(network)).toEqual(["16px", "16px", "4px", "4px"]);
    expect(await radii(list.last())).toEqual(["4px", "4px", "16px", "16px"]);
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("an item's corners change at once", async ({ page }) => {
      const first = items(everyLayout(page)).first();
      await first.hover();
      // no settling: with reduced motion nothing animates
      expect(await radii(first)).toEqual(all("12px"));
    });
  });
});
