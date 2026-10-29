import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor, settled } from "./support/helpers";

// Each case on /tests/button-group-connected is a Section with
// data-testid="button-group-connected-<caseId>", holding groups named by their aria-label
type ConnectedCaseId = "single" | "multi" | "sizes" | "square" | "rtl";

// A single-select group is a radiogroup, a multi-select one a group
const group = (
  page: Page,
  caseId: ConnectedCaseId,
  name: string,
  role: "radiogroup" | "group" = "radiogroup"
) =>
  page
    .getByTestId(`button-group-connected-${caseId}`)
    .getByRole(role, { name, exact: true });

const radio = (target: Locator, name: string) =>
  target.getByRole("radio", { name, exact: true });

const button = (target: Locator, name: string) =>
  target.getByRole("button", { name, exact: true });

// A group's buttons are its children, less any script Astro puts beside them
const BUTTONS = ":scope > :not(script, style, template)";

const items = (target: Locator) => target.locator(BUTTONS);

// Each button's box, in order
const boxes = (target: Locator) =>
  target.evaluate(
    (el, selector) =>
      [...el.querySelectorAll(selector)].map((child) => {
        const { left, right, width, height } = child.getBoundingClientRect();
        return { left, right, width, height };
      }),
    BUTTONS
  );

// A button's corner radii, from its start edge: start-top, end-top, end-bottom, start-bottom
const corners = (target: Locator) =>
  target.evaluate((el) => {
    const style = getComputedStyle(el);
    const radii = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((radius) => parseFloat(radius));
    return style.direction === "rtl"
      ? [radii[1], radii[0], radii[3], radii[2]]
      : radii;
  });

// M3's connected group, per size: its height, a round button's full corners (half its height),
// and the inner corners at rest and pressed. A selected button's corners are full.
const SIZES = [
  { name: "Extra small", height: 32, full: 16, inner: 8, pressed: 4 },
  { name: "Small", height: 40, full: 20, inner: 8, pressed: 4 },
  { name: "Medium", height: 56, full: 28, inner: 8, pressed: 4 },
  { name: "Large", height: 96, full: 48, inner: 16, pressed: 12 },
  { name: "Extra large", height: 136, full: 68, inner: 20, pressed: 16 },
] as const;

// Holds the pointer down on a button and waits for its corners to settle
const holdPressed = async (page: Page, target: Locator) => {
  const rect = await box(target);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await settled(page);
};

test.describe("ButtonGroup connected", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/button-group-connected");
  });

  // Compose gives a single-select group's buttons the radio button role
  test("single-select is a radiogroup of radios, one checked at a time", async ({
    page,
  }) => {
    const view = group(page, "single", "View");
    await expect(view.getByRole("radio")).toHaveCount(3);
    await expect(radio(view, "Week")).toBeChecked();
    await radio(view, "Day").click();
    await expect(radio(view, "Day")).toBeChecked();
    await expect(radio(view, "Week")).not.toBeChecked();
    await expect(radio(view, "Month")).not.toBeChecked();
    // without selection-required, the checked one unchecks
    await radio(view, "Day").click();
    await expect(view.getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("single-select with selection required keeps one checked", async ({
    page,
  }) => {
    const sort = group(page, "single", "Sort");
    await radio(sort, "Newest").click();
    await expect(radio(sort, "Newest")).toBeChecked();
    await radio(sort, "Oldest").click();
    await expect(radio(sort, "Oldest")).toBeChecked();
    await expect(radio(sort, "Newest")).not.toBeChecked();
    await expect(radio(sort, "Popular")).toBeDisabled();
  });

  test("multi-select is a group of toggle buttons, each pressed on its own", async ({
    page,
  }) => {
    const filters = group(page, "multi", "Filters", "group");
    await expect(filters.getByRole("radio")).toHaveCount(0);
    await button(filters, "Open").click();
    await expect(button(filters, "Open")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(button(filters, "Assigned")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await button(filters, "Assigned").click();
    await expect(button(filters, "Assigned")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    const save = group(page, "multi", "Save", "group");
    await button(save, "Bookmark").click();
    await expect(button(save, "Bookmark")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("multi-select with selection required keeps at least one pressed", async ({
    page,
  }) => {
    const days = group(page, "multi", "Days", "group");
    await button(days, "Monday").click();
    await expect(button(days, "Monday")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await button(days, "Tuesday").click();
    await button(days, "Monday").click();
    await expect(button(days, "Monday")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(button(days, "Tuesday")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  // M3's Accessibility page: the arrow keys move between the buttons, and Space or Enter selects
  test("the arrow keys move between the buttons without selecting, and Space selects", async ({
    page,
  }) => {
    const view = group(page, "single", "View");
    await radio(view, "Day").focus();
    await page.keyboard.press("ArrowRight");
    await expect(radio(view, "Week")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(radio(view, "Month")).toBeFocused();
    await expect(radio(view, "Week")).toBeChecked();
    await page.keyboard.press("Space");
    await expect(radio(view, "Month")).toBeChecked();
    await expect(radio(view, "Week")).not.toBeChecked();
    await page.keyboard.press("Tab");
    await expect(radio(view, "Month")).not.toBeFocused();
  });

  // M3's Specs: 2px between buttons at every size, full outer corners and the size's inner ones
  test("joins its buttons 2px apart, with full outer corners and small inner ones, in all five sizes", async ({
    page,
  }) => {
    for (const { name, height, full, inner } of SIZES) {
      const target = group(page, "sizes", name);
      const rects = await boxes(target);
      for (const [i, rect] of rects.entries()) {
        expect(rect.height, name).toBe(height);
        if (i > 0)
          expect(rect.left - rects[i - 1].right, name).toBeCloseTo(2, 1);
      }
      const [first, middle, last] = await items(target).all();
      expect(await corners(first), name).toEqual([full, inner, inner, full]);
      expect(await corners(middle), name).toEqual([inner, inner, inner, inner]);
      expect(await corners(last), name).toEqual([inner, full, full, inner]);
    }
  });

  // M3's Guidelines: a connected group spans its surface, its buttons sharing the width
  test("spans the width it's in, its buttons sharing it equally", async ({
    page,
  }) => {
    const target = group(page, "sizes", "Small");
    const section = page.getByTestId("button-group-connected-sizes");
    const sectionWidth = await section.evaluate((el) => {
      const style = getComputedStyle(el);
      return (
        el.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight)
      );
    });
    expect((await box(target)).width).toBeCloseTo(sectionWidth, 0);
    const [first, ...rest] = await boxes(target);
    for (const rect of rest) expect(rect.width).toBeCloseTo(first.width, 0);
  });

  // M3's Specs: extra small and small connected groups' buttons are at least 48px wide
  test("an extra small icon button is at least 48px wide", async ({ page }) => {
    const target = group(page, "sizes", "Extra small icons", "group");
    for (const rect of await boxes(target))
      expect(rect.width).toBeGreaterThanOrEqual(48);
  });

  test("a selected button morphs to full corners", async ({ page }) => {
    for (const { name, full } of SIZES) {
      const target = group(page, "sizes", name);
      const [, middle] = await items(target).all();
      await middle.click();
      await page.mouse.move(0, 0);
      await settled(page);
      expect(await corners(middle), name).toEqual([full, full, full, full]);
    }
  });

  // M3: only the pressed button's shape changes, its inner corners narrowing, and its neighbours
  // keep their widths
  test("a pressed button's inner corners narrow, and nothing else moves", async ({
    page,
  }) => {
    for (const { name, full, pressed } of SIZES) {
      const target = group(page, "sizes", name);
      await target.scrollIntoViewIfNeeded();
      const [first, middle] = await items(target).all();
      const before = await boxes(target);
      await holdPressed(page, middle);
      await expect
        .poll(() => corners(middle), { message: name })
        .toEqual([pressed, pressed, pressed, pressed]);
      expect(await boxes(target), name).toEqual(before);
      await page.mouse.up();
      await holdPressed(page, first);
      await expect
        .poll(() => corners(first), { message: name })
        .toEqual([full, pressed, pressed, full]);
      await page.mouse.up();
    }
  });

  // M3's Specs: a square group's outer corners are its inner ones
  test("a square group's buttons have the small corners all round, until selected", async ({
    page,
  }) => {
    const target = group(page, "square", "Square");
    for (const item of await items(target).all())
      expect(await corners(item)).toEqual([8, 8, 8, 8]);
    await radio(target, "Square one").click();
    await page.mouse.move(0, 0);
    await settled(page);
    expect(await corners(radio(target, "Square one"))).toEqual([
      20, 20, 20, 20,
    ]);
  });

  test("a selected button takes its style's selected colors, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const week = radio(group(page, "single", "View"), "Week");
      await settled(page);
      await expect(week).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-secondary)")
      );
      await expect(week).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-secondary)")
      );
    }
  });

  test("right to left, it runs from the right, its full corners on the outside", async ({
    page,
  }) => {
    const target = group(page, "rtl", "Right to left");
    const [first, second] = await boxes(target);
    expect(first.left).toBeGreaterThan(second.left);
    // corners() reads from the start edge, the right one here
    expect(await corners(radio(target, "First"))).toEqual([20, 8, 8, 20]);
    await radio(target, "First").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(radio(target, "Second")).toBeFocused();
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("a selected button's corners change at once", async ({ page }) => {
      const target = group(page, "sizes", "Small");
      const [, middle] = await items(target).all();
      await middle.click();
      await page.mouse.move(0, 0);
      expect(await corners(middle)).toEqual([20, 20, 20, 20]);
    });
  });
});
