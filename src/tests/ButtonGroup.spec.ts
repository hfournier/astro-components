import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, settled } from "./support/helpers";

// Each case on /tests/button-group is a Section with data-testid="button-group-<caseId>", holding
// groups named by their aria-label, or aria-labelledby
type ButtonGroupCaseId =
  "default" | "sizes" | "styles" | "toggle" | "disabled" | "rtl";

const group = (page: Page, caseId: ButtonGroupCaseId, name: string) =>
  page
    .getByTestId(`button-group-${caseId}`)
    .getByRole("group", { name, exact: true });

const button = (target: Locator, name: string) =>
  target.getByRole("button", { name, exact: true });

// A group's buttons are its children, less any script Astro puts beside them
const BUTTONS = ":scope > :not(script, style, template)";

// Each button's width, in order
const widths = (target: Locator) =>
  target.evaluate(
    (el, selector) =>
      [...el.querySelectorAll(selector)].map(
        (child) => child.getBoundingClientRect().width
      ),
    BUTTONS
  );

// The gaps between neighbouring buttons, in order across the page
const gaps = (target: Locator) =>
  target.evaluate((el, selector) => {
    const rects = [...el.querySelectorAll(selector)]
      .map((child) => child.getBoundingClientRect())
      .sort((a, b) => a.left - b.left);
    return rects.slice(1).map((rect, i) => rect.left - rects[i].right);
  }, BUTTONS);

// Compose's growth for a pressed button: 15% of its width, taken from its neighbours, each giving
// up no more than 24px (its trailing padding). A middle button takes half from each side.
const growth = (width: number, isMiddle: boolean) =>
  isMiddle
    ? 2 * Math.round(Math.min((0.15 * width) / 2, 24))
    : Math.round(Math.min(0.15 * width, 24));

// A press, with the button in view, long enough for the spring to settle on its widened widths
const holdPressed = async (page: Page, target: Locator) => {
  await target.scrollIntoViewIfNeeded();
  const { x, y, width, height } = await box(target);
  await page.mouse.move(x + width / 2, y + height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
};

// The widest each button gets over `ms` after `act` runs, frame by frame
const widestDuring = async (
  target: Locator,
  ms: number,
  act: () => Promise<void>
) => {
  const recording = target.evaluate(
    (el, { ms, selector }) =>
      new Promise<number[]>((resolve) => {
        const buttons = [...el.querySelectorAll(selector)];
        const widest = buttons.map(() => 0);
        const start = performance.now();
        const frame = (now: number) => {
          buttons.forEach((child, i) => {
            widest[i] = Math.max(
              widest[i],
              child.getBoundingClientRect().width
            );
          });
          if (now - start < ms) requestAnimationFrame(frame);
          else resolve(widest);
        };
        requestAnimationFrame(frame);
      }),
    { ms, selector: BUTTONS }
  );
  await act();
  return recording;
};

const radius = (target: Locator) =>
  target.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));

test.describe("ButtonGroup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/button-group");
  });

  test("is a group named with aria-label or aria-labelledby, not itself focusable", async ({
    page,
  }) => {
    await expect(group(page, "default", "Playback")).toBeVisible();
    await expect(group(page, "default", "Message actions")).toBeVisible();
    await expect(group(page, "default", "Playback")).not.toHaveAttribute(
      "tabindex"
    );
  });

  // M3's Accessibility page: Tab lands on the first button, then the arrow keys move between them
  test("Tab reaches each button, and the arrow keys move between them, stopping at the ends", async ({
    page,
  }) => {
    const playback = group(page, "default", "Playback");
    await button(playback, "Rewind").focus();
    await page.keyboard.press("Tab");
    await expect(button(playback, "Play now")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(playback, "Forward")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(playback, "Forward")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(button(playback, "Rewind")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(button(playback, "Rewind")).toBeFocused();
  });

  test("the arrow keys skip a disabled button", async ({ page }) => {
    const target = group(page, "disabled", "With a disabled button");
    await button(target, "Before").focus();
    await page.keyboard.press("ArrowRight");
    await expect(button(target, "After")).toBeFocused();
  });

  // M3's Specs: the group's height is its buttons', with 18, 12, 8, 8 and 8px between them
  test("spaces its buttons by their size, as tall as they are and as wide as they need", async ({
    page,
  }) => {
    for (const [name, height, gap] of [
      ["Extra small group", 32, 18],
      ["Small group", 40, 12],
      ["Medium group", 56, 8],
      ["Large group", 96, 8],
      ["Extra large group", 136, 8],
    ] as const) {
      const target = group(page, "sizes", name);
      for (const between of await gaps(target))
        expect(between).toBeCloseTo(gap, 1);
      const rect = await box(target);
      expect(rect.height).toBe(height);
      const buttons = await widths(target);
      expect(rect.width).toBeCloseTo(
        buttons.reduce((sum, width) => sum + width, 0) + 2 * gap,
        0
      );
    }
  });

  // The wider gap keeps the smaller buttons' 48px targets apart
  test("with buttons of mixed sizes, keeps the smallest one's spacing", async ({
    page,
  }) => {
    const [between] = await gaps(group(page, "sizes", "Mixed group"));
    expect(between).toBeCloseTo(18, 1);
  });

  // M3: button groups have no color of their own, so they hold any button style, in either theme
  test("draws nothing of its own, in light and dark", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const target = group(page, "default", "Playback");
      await expect(target).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(target).toHaveCSS("border-top-width", "0px");
      await expect(target).toHaveCSS("padding-left", "0px");
    }
  });

  test("pressing a middle button widens it, taking half from each neighbour, then restores them", async ({
    page,
  }) => {
    const target = group(page, "default", "Playback");
    const before = await widths(target);
    const groupWidth = (await box(target)).width;
    const grow = growth(before[1], true);
    await holdPressed(page, button(target, "Play now"));
    const pressed = await widths(target);
    expect(pressed[1]).toBeCloseTo(before[1] + grow, 0);
    expect(pressed[0]).toBeCloseTo(before[0] - grow / 2, 0);
    expect(pressed[2]).toBeCloseTo(before[2] - grow / 2, 0);
    expect((await box(target)).width).toBeCloseTo(groupWidth, 0);
    await page.mouse.up();
    await settled(page);
    expect(await widths(target)).toEqual(before);
  });

  test("pressing an end button widens it, taking it all from its one neighbour", async ({
    page,
  }) => {
    const target = group(page, "default", "Playback");
    const before = await widths(target);
    const grow = growth(before[0], false);
    await holdPressed(page, button(target, "Rewind"));
    const pressed = await widths(target);
    expect(pressed[0]).toBeCloseTo(before[0] + grow, 0);
    expect(pressed[1]).toBeCloseTo(before[1] - grow, 0);
    expect(pressed[2]).toBeCloseTo(before[2], 0);
    await page.mouse.up();
  });

  // Compose waits until the widening is 75% done before springing back, so a tap still shows
  test("a quick tap still widens the button most of the way", async ({
    page,
  }) => {
    const target = group(page, "default", "Playback");
    const before = await widths(target);
    const widest = await widestDuring(target, 700, () =>
      button(target, "Play now").click()
    );
    expect(widest[1] - before[1]).toBeGreaterThanOrEqual(
      0.75 * growth(before[1], true)
    );
    await settled(page);
    expect(await widths(target)).toEqual(before);
  });

  test("holding Space on a focused button widens it too", async ({ page }) => {
    const target = group(page, "default", "Message actions");
    const before = await widths(target);
    await button(target, "Share").focus();
    await page.keyboard.down("Space");
    await page.waitForTimeout(600);
    expect((await widths(target))[1]).toBeCloseTo(
      before[1] + growth(before[1], true),
      0
    );
    await page.keyboard.up("Space");
    await settled(page);
    expect(await widths(target)).toEqual(before);
  });

  // The key can be let go elsewhere, as when Enter opens a dialog
  test("a key press ends when focus leaves the button", async ({ page }) => {
    const target = group(page, "default", "Message actions");
    const before = await widths(target);
    await button(target, "Share").focus();
    await page.keyboard.down("Space");
    await page.waitForTimeout(600);
    await button(target, "Share").blur();
    await settled(page);
    expect(await widths(target)).toEqual(before);
    await page.keyboard.up("Space");
  });

  test("holds icon buttons and buttons together, widening either", async ({
    page,
  }) => {
    const target = group(page, "sizes", "Small group");
    const before = await widths(target);
    await holdPressed(page, button(target, "Small add"));
    expect((await widths(target))[1]).toBeCloseTo(
      before[1] + growth(before[1], true),
      0
    );
    await page.mouse.up();
  });

  // M3's Specs: square groups, and outlined and elevated buttons, widen the same way
  test("square, outlined and elevated groups widen a pressed button too", async ({
    page,
  }) => {
    for (const [name, pressedName] of [
      ["Square", "Square start"],
      ["Outlined", "Outlined start"],
      ["Elevated", "Elevated start"],
    ] as const) {
      const target = group(page, "styles", name);
      const before = await widths(target);
      await holdPressed(page, button(target, pressedName));
      expect((await widths(target))[0], name).toBeCloseTo(
        before[0] + growth(before[0], false),
        0
      );
      await page.mouse.up();
      await settled(page);
    }
  });

  test("a disabled button doesn't widen", async ({ page }) => {
    const target = group(page, "disabled", "With a disabled button");
    const before = await widths(target);
    await holdPressed(page, button(target, "Unavailable"));
    expect(await widths(target)).toEqual(before);
    await page.mouse.up();
  });

  // M3: a selected toggle swaps shape, round for square or square for round
  test("a toggle button in a group changes shape when selected", async ({
    page,
  }) => {
    const target = group(page, "toggle", "Save to");
    // the small round button's corners are 20px, its square ones 12px
    expect(await radius(button(target, "Favorite"))).toBe(12);
    for (const name of ["Star", "Bookmark"]) {
      expect(await radius(button(target, name))).toBe(20);
      await button(target, name).click();
      await expect(button(target, name)).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await page.mouse.move(0, 0);
      await settled(page);
      expect(await radius(button(target, name))).toBe(12);
    }

    const square = button(group(page, "styles", "Square"), "Square star");
    expect(await radius(square)).toBe(12);
    await square.click();
    await page.mouse.move(0, 0);
    await settled(page);
    expect(await radius(square)).toBe(20);
  });

  test("right to left, it runs from the right, and the arrow keys follow it", async ({
    page,
  }) => {
    const target = group(page, "rtl", "Right to left");
    const first = await box(button(target, "First"));
    const second = await box(button(target, "Second"));
    expect(first.x).toBeGreaterThan(second.x);
    await button(target, "First").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(button(target, "Second")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(target, "First")).toBeFocused();

    const before = await widths(target);
    const grow = growth(before[0], false);
    await holdPressed(page, button(target, "First"));
    const pressed = await widths(target);
    expect(pressed[0]).toBeCloseTo(before[0] + grow, 0);
    // its neighbour on the left gives up the width
    expect(pressed[1]).toBeCloseTo(before[1] - grow, 0);
    // it grows from the group's start, its right edge
    expect((await box(button(target, "First"))).x + pressed[0]).toBeCloseTo(
      first.x + first.width,
      0
    );
    await page.mouse.up();
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    // ADR-0003: the widening is decorative, so it's skipped outright
    test("pressing a button leaves the widths alone", async ({ page }) => {
      const target = group(page, "default", "Playback");
      const before = await widths(target);
      await holdPressed(page, button(target, "Play now"));
      expect(await widths(target)).toEqual(before);
      await page.mouse.up();
    });
  });
});
