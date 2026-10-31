import { test, expect } from "./support/a11y-fixture";
import { box } from "./support/helpers";

test.describe("ChipGroup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/chip-group");
  });

  test("is a group, named through aria", async ({ page }) => {
    await expect(
      page.getByRole("group", { name: "Wrapping", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Scrolling", exact: true })
    ).toBeVisible();
  });

  // M3's Guidelines: chips inline as a row of options, at least 8dp apart, overflowing onto the
  // next line, which its placement diagram sets 16dp below, so the 48dp targets don't overlap
  test("sets its chips 8px apart, wrapping onto new rows 16px apart", async ({ page }) => {
    const group = page.getByRole("group", { name: "Wrapping", exact: true });
    const chips = group.getByRole("button");
    const [first, second, third, fourth] = await Promise.all(
      [0, 1, 2, 3].map((i) => box(chips.nth(i)))
    );
    expect(second.x - (first.x + first.width)).toBeCloseTo(8, 0);
    expect(second.y).toBe(first.y);
    const wrapped = [third, fourth].find((b) => b.y > first.y);
    expect(wrapped).toBeDefined();
    expect(wrapped!.y - (first.y + first.height)).toBeCloseTo(16, 0);
  });

  // M3's Guidelines: a set in one row can scroll sideways instead
  test("with overflow scroll, keeps one row that scrolls, lined up with its surroundings", async ({
    page,
  }) => {
    const group = page.getByRole("group", { name: "Scrolling", exact: true });
    const chips = group.locator("[data-ac-base-chip]");
    const rows = new Set(
      await Promise.all(
        [0, 1, 2, 3, 4].map(async (i) => (await box(chips.nth(i))).y)
      )
    );
    expect(rows.size).toBe(1);
    expect(await group.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true
    );
    const frame = await box(page.getByTestId("chip-group-scroll-frame"));
    expect((await box(chips.first())).x).toBeCloseTo(frame.x, 0);
    // the last chip scrolls into view as the arrow keys reach it
    await page.getByRole("checkbox", { name: "Docs", exact: true }).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("checkbox", { name: "Images", exact: true })
    ).toBeFocused();
    expect(await group.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });

  // M3's Accessibility page: the arrow keys move between the chips of a set, which the group is
  test("the arrow keys move between its chips, not between chips outside a group", async ({
    page,
  }) => {
    const group = page.getByRole("group", { name: "Wrapping", exact: true });
    await group.getByRole("button", { name: "Directions" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("button", { name: "Calendar" })).toBeFocused();
    const loose = page.getByTestId("chip-group-loose");
    await loose.getByRole("button", { name: "Loose one" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      loose.getByRole("button", { name: "Loose one" })
    ).toBeFocused();
  });
});
