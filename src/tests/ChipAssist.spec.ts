import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  alpha,
  box,
  castsNoShadow,
  css,
  elevation,
  expectFocusRing,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/chip-assist is a Section with data-testid="chip-assist-<caseId>"
type ChipCaseId =
  "styles" | "outline" | "disabled" | "link" | "set" | "dragged" | "rtl";

const chip = (page: Page, caseId: ChipCaseId, name: string) =>
  page
    .getByTestId(`chip-assist-${caseId}`)
    .getByRole(caseId === "link" ? "link" : "button", { name, exact: true });

const leadingIcon = (target: Locator) =>
  target.locator("[data-ac-base-chip-part=leading-icon]");

const stateLayerOpacity = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el, "::before").opacity);

const shadowOf = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el).boxShadow);

// The chip's padding from its start edge to the content, and from the content to its end edge,
// rounded: Firefox and WebKit measure text to a fraction of a pixel
const insets = async (target: Locator) => {
  const outer = await box(target);
  const inner = await target.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const { left, right } = range.getBoundingClientRect();
    return { left, right, rtl: getComputedStyle(el).direction === "rtl" };
  });
  const left = inner.left - outer.x;
  const right = outer.x + outer.width - inner.right;
  return (inner.rtl ? [right, left] : [left, right]).map(Math.round);
};

test.describe("ChipAssist", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/chip-assist");
  });

  test("is a button named by its label, its icon hidden", async ({ page }) => {
    const target = chip(page, "styles", "Add to calendar");
    await expect(target).toHaveJSProperty("tagName", "BUTTON");
    await expect(target).toHaveAttribute("type", "button");
    await expect(leadingIcon(target)).toHaveAttribute("aria-hidden", "true");
  });

  test("works as a link", async ({ page }) => {
    const link = chip(page, "link", "Open map");
    await expect(link).toHaveAttribute("href", "#chip-assist-link");
    await expect(link).not.toHaveAttribute("type");
    await expect(link).toHaveCSS("height", "32px");
  });

  // M3's Specs: 32dp tall, 8dp corners, 16dp padding, 8dp with an icon (on its side), an 18dp
  // icon 8dp from the label, and the label in Label Large
  test("has M3's measurements and type", async ({ page }) => {
    const plain = chip(page, "styles", "Get directions");
    const withIcon = chip(page, "styles", "Add to calendar");
    for (const target of [plain, withIcon]) {
      await expect(target).toHaveCSS("height", "32px");
      await expect(target).toHaveCSS("border-top-left-radius", "8px");
      await expect(target).toHaveCSS("font-size", "14px");
      await expect(target).toHaveCSS("line-height", "20px");
      await expect(target).toHaveCSS("font-weight", "500");
      await expect(target).toHaveCSS("letter-spacing", "0.1px");
    }
    expect(await insets(plain)).toEqual([16, 16]);
    expect(await insets(withIcon)).toEqual([8, 16]);
    const icon = await box(leadingIcon(withIcon));
    expect([icon.width, icon.height]).toEqual([18, 18]);
    await expect(withIcon).toHaveCSS("column-gap", "8px");
  });

  // M3's Specs: flat on an outline-variant outline, elevated on surface-container-low at level 1;
  // the label on-surface, the icon primary
  test("each style takes M3's colors, in light and dark", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const onSurface = await resolvedColor(
        page,
        "var(--theme-color-on-surface)"
      );
      const primary = await resolvedColor(page, "var(--theme-color-primary)");

      const flat = chip(page, "styles", "Add to calendar");
      await expect(flat).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(flat).toHaveCSS(
        "border-top-color",
        await resolvedColor(page, "var(--theme-color-outline-variant)")
      );
      await expect(flat).toHaveCSS("border-top-width", "1px");
      await expect(flat).toHaveCSS("color", onSurface);
      await expect(leadingIcon(flat)).toHaveCSS("color", primary);
      expect(await castsNoShadow(flat)).toBe(true);

      const elevated = chip(page, "styles", "Check in");
      await expect(elevated).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
      await expect(elevated).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
      await expect(elevated).toHaveCSS("color", onSurface);
      await expect(leadingIcon(elevated)).toHaveCSS("color", primary);
      expect(await shadowOf(elevated)).toContain(await elevation(page, 1));
    }
  });

  // The docs' tip for M3's Accessibility page: the outline role instead, for 3:1 contrast. The
  // class replaces only the outline's color, which still turns the label's color when focused.
  test("a flat chip given the outline role keeps its 1px outline, in that color", async ({
    page,
  }) => {
    const target = chip(page, "outline", "Turn on lights");
    await expect(target).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-outline)")
    );
    await expect(target).toHaveCSS("border-top-width", "1px");
    await chip(page, "outline", "Lock doors").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(target).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );
  });

  // M3's Specs: the label and icon on-surface at 38%, a flat outline or an elevated container
  // on-surface at 12%, and no shadow
  test("disabled, it takes M3's disabled colors", async ({ page }) => {
    const flat = chip(page, "disabled", "Flat disabled");
    await expect(flat).toBeDisabled();
    const elevated = chip(page, "disabled", "Elevated disabled");
    for (const [target, property, opacity] of [
      [flat, "color", 0.38],
      [leadingIcon(flat), "color", 0.38],
      [flat, "border-top-color", 0.12],
      [elevated, "color", 0.38],
      [elevated, "background-color", 0.12],
    ] as const) {
      await expect
        .poll(async () => alpha(await css(target, property)))
        .toBeCloseTo(opacity, 2);
    }
    expect(await castsNoShadow(elevated)).toBe(true);
  });

  // M3's Specs: an on-surface state layer at 8% hovered and 10% focused or pressed
  test("shows M3's state layer hovered, focused and pressed", async ({
    page,
  }) => {
    const target = chip(page, "styles", "Get directions");
    await expect.poll(() => stateLayerOpacity(target)).toBe("0");
    await target.hover();
    await expect.poll(() => stateLayerOpacity(target)).toBe("0.08");
    await page.mouse.down();
    await expect.poll(() => stateLayerOpacity(target)).toBe("0.1");
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await target.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect.poll(() => stateLayerOpacity(target)).toBe("0.1");
  });

  test("a disabled chip shows no state layer on hover", async ({ page }) => {
    const target = chip(page, "disabled", "Flat disabled");
    await target.hover({ force: true });
    await expect.poll(() => stateLayerOpacity(target)).toBe("0");
  });

  // M3's Specs: a focused flat chip's outline turns the label's color, beside the focus ring
  test("keyboard-focused, it shows the focus ring and a flat chip's outline turns on-surface", async ({
    page,
  }) => {
    const target = chip(page, "styles", "Get directions");
    await chip(page, "styles", "Add to calendar").focus();
    await page.keyboard.press("Shift+Tab");
    await expectFocusRing(target);
    await expect(target).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );
  });

  // M3's Specs: an elevated chip rises from level 1 to 2 on hover, and is back at 1 pressed or
  // focused
  test("an elevated chip rises to level 2 on hover, at level 1 pressed or focused", async ({
    page,
  }) => {
    const elevated = chip(page, "styles", "Share trip");
    await elevated.hover();
    await expect
      .poll(() => shadowOf(elevated))
      .toContain(await elevation(page, 2));
    await page.mouse.down();
    await expect
      .poll(() => shadowOf(elevated))
      .toContain(await elevation(page, 1));
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await chip(page, "styles", "Check in").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(elevated).toBeFocused();
    await expect
      .poll(() => shadowOf(elevated))
      .toContain(await elevation(page, 1));
  });

  // M3's Specs: a dragged chip rises to level 4 with a 16% state layer
  test("dragged, a draggable chip rises to level 4 with a 16% state layer, and settles when dropped", async ({
    page,
  }) => {
    for (const name of ["Flat drag", "Elevated drag"]) {
      const target = chip(page, "dragged", name);
      await target.dispatchEvent("dragstart");
      await expect(target).toHaveAttribute("data-ac-base-chip-dragged", "");
      await expect
        .poll(() => shadowOf(target), name)
        .toContain(await elevation(page, 4));
      await expect.poll(() => stateLayerOpacity(target), name).toBe("0.16");
      await target.dispatchEvent("dragend");
      await expect(target).not.toHaveAttribute("data-ac-base-chip-dragged");
    }
  });

  // A drag holds the pointer down over the chip, so it's also hovered and pressed: the dragged
  // state still wins. Playwright can't start a native drag from a button, so the chip is marked
  // as dragstart would, and then hovered and pressed.
  test("dragged while hovered and pressed, the dragged state still wins", async ({
    page,
  }) => {
    const target = chip(page, "dragged", "Elevated drag");
    await target.dispatchEvent("dragstart");
    await target.hover();
    await page.mouse.down();
    await expect
      .poll(() => shadowOf(target))
      .toContain(await elevation(page, 4));
    await expect.poll(() => stateLayerOpacity(target)).toBe("0.16");
    await page.mouse.up();
  });

  // M3's Accessibility page: a 48px target, for every chip
  test("has a 48px touch target", async ({ page }) => {
    const target = chip(page, "styles", "Get directions");
    const size = await target.evaluate((el) => {
      const style = getComputedStyle(el, "::after");
      return [parseFloat(style.width), parseFloat(style.height)];
    });
    expect(size[1]).toBe(48);
    expect(size[0]).toBeGreaterThanOrEqual(48);
  });

  // M3's Accessibility page: Tab reaches each chip, and the arrow keys move between them
  test("the arrow keys move between the chips in a set, skipping disabled ones and stopping at the ends", async ({
    page,
  }) => {
    const one = chip(page, "set", "One");
    const three = chip(page, "set", "Three");
    const four = page
      .getByTestId("chip-assist-set")
      .getByRole("link", { name: "Four" });
    await one.focus();
    await page.keyboard.press("ArrowRight");
    await expect(three).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(four).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(four).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(three).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(one).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(one).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(three).toBeFocused();
    // in a set that wraps onto more rows, up and down move the same way, as left and right
    await page.keyboard.press("ArrowDown");
    await expect(four).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(three).toBeFocused();
  });

  test("right to left, the icon leads on the right, and the arrow keys are mirrored", async ({
    page,
  }) => {
    const withIcon = chip(page, "rtl", "أضف إلى التقويم");
    const [chipBox, iconBox] = [
      await box(withIcon),
      await box(leadingIcon(withIcon)),
    ];
    expect(chipBox.x + chipBox.width - (iconBox.x + iconBox.width)).toBeCloseTo(
      8,
      0
    );
    expect(await insets(withIcon)).toEqual([8, 16]);
    await withIcon.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(chip(page, "rtl", "شارك")).toBeFocused();
  });
});
