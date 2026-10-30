import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  alpha,
  castsNoShadow,
  css,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/chip-suggestion is a Section with data-testid="chip-suggestion-<caseId>".
// ChipSuggestion is drawn by BaseChip, as ChipAssist is, so ChipAssist's spec covers the states,
// measurements, dragging and keyboard they share; this one covers what's its own.
const chip = (page: Page, name: string) =>
  page
    .getByTestId("chip-suggestion-styles")
    .getByRole("button", { name, exact: true });

test.describe("ChipSuggestion", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/chip-suggestion");
  });

  // M3's Specs: the label on-surface-variant, the icon primary, on an outline-variant outline or
  // a surface-container-low container
  test("takes M3's suggestion chip colors, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const onSurfaceVariant = await resolvedColor(
        page,
        "var(--theme-color-on-surface-variant)"
      );
      const flat = chip(page, "Sounds good");
      await expect(flat).toHaveCSS("color", onSurfaceVariant);
      await expect(flat).toHaveCSS(
        "border-top-color",
        await resolvedColor(page, "var(--theme-color-outline-variant)")
      );
      await expect(
        chip(page, "Later today").locator(
          "[data-ac-base-chip-part=leading-icon]"
        )
      ).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-primary)")
      );
      const elevated = chip(page, "See you there");
      await expect(elevated).toHaveCSS("color", onSurfaceVariant);
      await expect(elevated).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
      expect(await castsNoShadow(elevated)).toBe(false);
    }
  });

  // Tailwind's `/38` mixes in oklab, so the label is compared by alpha
  test("disabled, its label is on-surface at 38%", async ({ page }) => {
    expect(alpha(await css(chip(page, "Not now"), "color"))).toBeCloseTo(
      0.38,
      2
    );
  });

  // M3's Specs: a focused flat chip's outline turns the label's color
  test("keyboard-focused, a flat chip's outline turns on-surface-variant", async ({
    page,
  }) => {
    const target = chip(page, "Sounds good");
    await chip(page, "Later today").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(target).toBeFocused();
    await expect(target).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
  });

  test("an elevated chip with an icon keeps its colors; disabled, its container fades and loses its shadow", async ({
    page,
  }) => {
    const withIcon = chip(page, "Next week");
    await expect(withIcon).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
    expect(await castsNoShadow(withIcon)).toBe(false);
    const disabled = chip(page, "Never");
    expect(alpha(await css(disabled, "background-color"))).toBeCloseTo(0.12, 2);
    expect(await castsNoShadow(disabled)).toBe(true);
  });

  test("right to left, the icon leads on the right, and the arrow keys are mirrored", async ({
    page,
  }) => {
    const rtl = page.getByTestId("chip-suggestion-rtl");
    const withIcon = rtl.getByRole("button", { name: "لاحقًا اليوم" });
    const [chipBox, iconBox] = await Promise.all([
      withIcon.boundingBox(),
      withIcon.locator("[data-ac-base-chip-part=leading-icon]").boundingBox(),
    ]);
    expect(
      chipBox!.x + chipBox!.width - (iconBox!.x + iconBox!.width)
    ).toBeCloseTo(8, 0);
    await withIcon.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(rtl.getByRole("button", { name: "يبدو جيدًا" })).toBeFocused();
  });

  test("works as a link, 32px tall", async ({ page }) => {
    const link = page
      .getByTestId("chip-suggestion-link")
      .getByRole("link", { name: "Nearby cafés" });
    await expect(link).toHaveAttribute("href", "#chip-suggestion-link");
    await expect(link).toHaveCSS("height", "32px");
  });
});
