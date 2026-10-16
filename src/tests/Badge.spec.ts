import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/badge holds one Badge beside the Icon it's anchored to, and the Badge is
// the only aria-hidden <span> there: badge-count "Inbox, 3 unread" (label 3), badge-no-label
// "Notifications, new activity" (no label, a dot), badge-over-999 "Messages, 1500 unread" (label 1500).
type BadgeCase = "count" | "no-label" | "over-999";

const testCase = (page: Page, name: BadgeCase) =>
  page.getByTestId(`badge-${name}`);
const anchor = (page: Page, name: BadgeCase) =>
  testCase(page, name).locator("svg[aria-label]");
const badge = (page: Page, name: BadgeCase) =>
  testCase(page, name).locator('span[aria-hidden="true"]').first();

test.describe("Badge", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/badge");
  });

  test("shows its count on the error role and is hidden from assistive tech", async ({
    page,
  }) => {
    const target = badge(page, "count");

    await expect(target).toHaveText("3");
    await expect(target).toHaveAttribute("aria-hidden", "true");
    await expect(target).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-error)")
    );
    await expect(target).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-error)")
    );
  });

  test("the anchor icon carries the count in the button's accessible name", async ({
    page,
  }) => {
    await expect(
      testCase(page, "count").getByRole("button")
    ).toHaveAccessibleName("Inbox, 3 unread");
  });

  test("a one-digit count is M3's 16px square large badge", async ({
    page,
  }) => {
    const { width, height } = await box(badge(page, "count"));

    expect({ width, height }).toEqual({ width: 16, height: 16 });
  });

  test("a badge with a count overlaps its anchor's top-end corner, per M3's offsets", async ({
    page,
  }) => {
    const icon = await box(anchor(page, "count"));
    const target = await box(badge(page, "count"));

    expect(target.x).toBeCloseTo(icon.x + icon.width - 12, 0);
    expect(target.y).toBeCloseTo(icon.y - 2, 0);
  });

  test("without a label it is a 6px dot on its anchor's top-end corner", async ({
    page,
  }) => {
    const target = badge(page, "no-label");

    await expect(target).toHaveText("");

    const icon = await box(anchor(page, "no-label"));
    const dot = await box(target);
    expect({ width: dot.width, height: dot.height }).toEqual({
      width: 6,
      height: 6,
    });
    expect(dot.x + dot.width).toBeCloseTo(icon.x + icon.width, 0);
    expect(dot.y).toBeCloseTo(icon.y, 0);
  });

  test("caps a count over 999 at 999+", async ({ page }) => {
    await expect(badge(page, "over-999")).toHaveText("999+");
  });

  test("its widest, 999+, is about M3's 34px", async ({ page }) => {
    // M3 gives 16x34px; the font's rendering of 11px text with 0.5px tracking varies by about 1px
    const { width, height } = await box(badge(page, "over-999"));

    expect(height).toBe(16);
    expect(Math.abs(width - 34)).toBeLessThanOrEqual(1.5);
  });
});
