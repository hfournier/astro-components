import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, settled } from "./support/helpers";

// Each case on /tests/button-group is a Section with data-testid="button-group-<caseId>", holding
// groups named by their aria-label, or aria-labelledby
const group = (page: Page, name: string) =>
  page.getByRole("group", { name, exact: true });

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

// Each button's width, in order. Astro can put a script beside them, which isn't one.
const widths = (target: Locator) =>
  target.evaluate((el) =>
    [...el.querySelectorAll(":scope > :not(script, style, template)")].map(
      (child) => child.getBoundingClientRect().width
    )
  );

// The gaps between neighbouring buttons, in order across the page
const gaps = (target: Locator) =>
  target.evaluate((el) => {
    const rects = [
      ...el.querySelectorAll(":scope > :not(script, style, template)"),
    ]
      .map((child) => child.getBoundingClientRect())
      .sort((a, b) => a.left - b.left);
    return rects.slice(1).map((rect, i) => rect.left - rects[i].right);
  });

// Compose's growth for a pressed button: 15% of its width, taken from its neighbours, each giving
// up no more than 24px (its trailing padding). A middle button takes half from each side.
const growth = (width: number, isMiddle: boolean) =>
  isMiddle
    ? 2 * Math.round(Math.min((0.15 * width) / 2, 24))
    : Math.round(Math.min(0.15 * width, 24));

// A press long enough for the spring to settle on its widened widths
const holdPressed = async (page: Page, target: Locator) => {
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
    (el, ms) =>
      new Promise<number[]>((resolve) => {
        const widest = [
          ...el.querySelectorAll(":scope > :not(script, style, template)"),
        ].map(() => 0);
        const start = performance.now();
        const frame = (now: number) => {
          [
            ...el.querySelectorAll(":scope > :not(script, style, template)"),
          ].forEach((child, i) => {
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
    ms
  );
  await act();
  return recording;
};

test.describe("ButtonGroup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/button-group");
  });

  test("is a group named with aria-label or aria-labelledby, not itself focusable", async ({
    page,
  }) => {
    await expect(group(page, "Playback")).toBeVisible();
    await expect(group(page, "Message actions")).toBeVisible();
    await expect(group(page, "Playback")).not.toHaveAttribute("tabindex");
  });

  // M3's Accessibility page: Tab lands on the first button, then the arrow keys move between them
  test("Tab reaches each button, and the arrow keys move between them, stopping at the ends", async ({
    page,
  }) => {
    await button(page, "Rewind").focus();
    await page.keyboard.press("Tab");
    await expect(button(page, "Play now")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(page, "Forward")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(page, "Forward")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(button(page, "Rewind")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(button(page, "Rewind")).toBeFocused();
  });

  test("the arrow keys skip a disabled button", async ({ page }) => {
    await button(page, "Before").focus();
    await page.keyboard.press("ArrowRight");
    await expect(button(page, "After")).toBeFocused();
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
      const target = group(page, name);
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
    const [between] = await gaps(group(page, "Mixed group"));
    expect(between).toBeCloseTo(18, 1);
  });

  // M3: button groups have no color of their own
  test("draws nothing of its own", async ({ page }) => {
    const target = group(page, "Playback");
    await expect(target).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(target).toHaveCSS("border-top-width", "0px");
    await expect(target).toHaveCSS("padding-left", "0px");
  });

  test("pressing a middle button widens it, taking half from each neighbour, then restores them", async ({
    page,
  }) => {
    const target = group(page, "Playback");
    const before = await widths(target);
    const groupWidth = (await box(target)).width;
    const grow = growth(before[1], true);
    await holdPressed(page, button(page, "Play now"));
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
    const target = group(page, "Playback");
    const before = await widths(target);
    const grow = growth(before[0], false);
    await holdPressed(page, button(page, "Rewind"));
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
    const target = group(page, "Playback");
    const before = await widths(target);
    const widest = await widestDuring(target, 700, () =>
      button(page, "Play now").click()
    );
    expect(widest[1] - before[1]).toBeGreaterThanOrEqual(
      0.75 * growth(before[1], true)
    );
    await settled(page);
    expect(await widths(target)).toEqual(before);
  });

  test("holding Space on a focused button widens it too", async ({ page }) => {
    const target = group(page, "Message actions");
    const before = await widths(target);
    await button(page, "Share").focus();
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

  test("holds icon buttons and buttons together, widening either", async ({
    page,
  }) => {
    const target = group(page, "Small group");
    const before = await widths(target);
    await holdPressed(page, button(page, "Small add"));
    expect((await widths(target))[1]).toBeCloseTo(
      before[1] + growth(before[1], true),
      0
    );
    await page.mouse.up();
  });

  test("a disabled button doesn't widen", async ({ page }) => {
    const target = group(page, "With a disabled button");
    const before = await widths(target);
    await holdPressed(page, button(page, "Unavailable"));
    expect(await widths(target)).toEqual(before);
    await page.mouse.up();
  });

  // M3: a selected toggle swaps shape, round for square or square for round
  test("a toggle button in a group changes shape when selected", async ({
    page,
  }) => {
    const radius = (name: string) =>
      button(page, name).evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopLeftRadius)
      );
    expect(await radius("Favorite")).toBe(12);
    await button(page, "Star").click();
    await expect(button(page, "Star")).toHaveAttribute("aria-pressed", "true");
    await settled(page);
    expect(await radius("Star")).toBe(12);
    await button(page, "Bookmark").click();
    await settled(page);
    expect(await radius("Bookmark")).toBe(12);
  });

  test("right to left, it runs from the right, and the arrow keys follow it", async ({
    page,
  }) => {
    const first = await box(button(page, "First"));
    const second = await box(button(page, "Second"));
    expect(first.x).toBeGreaterThan(second.x);
    await button(page, "First").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(button(page, "Second")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(page, "First")).toBeFocused();

    const target = group(page, "Right to left");
    const before = await widths(target);
    const grow = growth(before[0], false);
    await holdPressed(page, button(page, "First"));
    const pressed = await widths(target);
    expect(pressed[0]).toBeCloseTo(before[0] + grow, 0);
    expect(pressed[1]).toBeCloseTo(before[1] - grow, 0);
    // it grows from the group's start, its right edge
    expect((await box(button(page, "First"))).x + pressed[0]).toBeCloseTo(
      first.x + first.width,
      0
    );
    await page.mouse.up();
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    // ADR-0003: the widening is decorative, so it's skipped outright
    test("pressing a button leaves the widths alone", async ({ page }) => {
      const target = group(page, "Playback");
      const before = await widths(target);
      await holdPressed(page, button(page, "Play now"));
      expect(await widths(target)).toEqual(before);
      await page.mouse.up();
    });
  });
});
