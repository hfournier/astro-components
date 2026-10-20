import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/badge holds one Badge beside the Icon it's anchored to, and the Badge is
// the only aria-hidden <span> there. Cases are keyed by id to their anchor Icon's accessible name:
// count has label 3, no-label is a dot, over-999 has label 1500. The rtl case, right to left, holds
// a count of 3 and a dot, then an inline count after "Inbox", so it's found by order instead.
const anchorNames = {
  count: "Inbox, 3 unread",
  "no-label": "Notifications, new activity",
  "over-999": "Messages, 1500 unread",
} as const;
type BadgeCaseId = keyof typeof anchorNames;

const badgeCase = (page: Page, caseId: BadgeCaseId) =>
  page.getByTestId(`badge-${caseId}`);
const anchor = (page: Page, caseId: BadgeCaseId) =>
  badgeCase(page, caseId).locator(`svg[aria-label="${anchorNames[caseId]}"]`);
const badge = (page: Page, caseId: BadgeCaseId) =>
  badgeCase(page, caseId).locator('span[aria-hidden="true"]').first();

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
      badgeCase(page, "count").getByRole("button")
    ).toHaveAccessibleName(anchorNames.count);
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

  test.describe("right to left", () => {
    const rtl = (page: Page) => page.getByTestId("badge-rtl");
    const rtlIcon = (page: Page, name: string) =>
      rtl(page).locator(`svg[aria-label="${name}"]`);
    const rtlBadge = (page: Page, index: number) =>
      rtl(page).locator('span[aria-hidden="true"]').nth(index);

    test("a badge with a count mirrors M3's offsets onto its anchor's top-left corner", async ({
      page,
    }) => {
      const icon = await box(rtlIcon(page, "Inbox, 3 unread"));
      const target = await box(rtlBadge(page, 0));

      expect(target.x + target.width).toBeCloseTo(icon.x + 12, 0);
      expect(target.y).toBeCloseTo(icon.y - 2, 0);
    });

    test("a dot sits on its anchor's top-left corner", async ({ page }) => {
      const icon = await box(rtlIcon(page, "Notifications, new activity"));
      const dot = await box(rtlBadge(page, 1));

      expect(dot.x).toBeCloseTo(icon.x, 0);
      expect(dot.y).toBeCloseTo(icon.y, 0);
    });

    test("an inline badge follows the text, to its left", async ({ page }) => {
      const text = page.getByTestId("badge-rtl-inline");
      const target = await box(
        text.locator('span[aria-hidden="true"]').first()
      );
      const word = await box(text);

      expect(target.x).toBeCloseTo(word.x, 0);
    });
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
