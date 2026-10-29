import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, castsNoShadow, resolvedColor, settled } from "./support/helpers";

// Each case on /tests/button-group-connected is a Section with
// data-testid="button-group-connected-<caseId>", holding groups named by their aria-label
type ConnectedCaseId = "single" | "multi" | "sizes" | "styles" | "form" | "rtl";

// A single-select group is a radiogroup of radios, a multi-select one a group of checkboxes
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

const checkbox = (target: Locator, name: string) =>
  target.getByRole("checkbox", { name, exact: true });

// The option drawn around an input: the label it sits in
const option = (input: Locator) => input.locator("xpath=..");

const options = (target: Locator) =>
  target.locator("[data-ac-button-group-connected-part=option]");

// Each option's box, in order
const boxes = (target: Locator) =>
  options(target).evaluateAll((labels) =>
    labels.map((label) => {
      const { left, right, width, height } = label.getBoundingClientRect();
      return { left, right, width, height };
    })
  );

// An option's corner radii, from its start edge: start-top, end-top, end-bottom, start-bottom
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

// M3's connected group, per size: its height, a round option's full corners (half its height),
// and the inner corners at rest and pressed. A selected option's corners are full.
const SIZES = [
  { name: "Extra small", height: 32, full: 16, inner: 8, pressed: 4 },
  { name: "Small", height: 40, full: 20, inner: 8, pressed: 4 },
  { name: "Medium", height: 56, full: 28, inner: 8, pressed: 4 },
  { name: "Large", height: 96, full: 48, inner: 16, pressed: 12 },
  { name: "Extra large", height: 136, full: 68, inner: 20, pressed: 16 },
] as const;

// Holds the pointer down on an option
const holdPressed = async (page: Page, target: Locator) => {
  const rect = await box(target);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
};

// Clicks an option, moves the pointer off and waits for it to settle
const select = async (page: Page, target: Locator) => {
  await target.click();
  await page.mouse.move(0, 0);
  await settled(page);
};

test.describe("ButtonGroupConnected", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/button-group-connected");
  });

  test("single-select is a radiogroup of native radios, one checked at a time", async ({
    page,
  }) => {
    const view = group(page, "single", "View");
    await expect(view.getByRole("radio")).toHaveCount(3);
    await expect(radio(view, "Week")).toBeChecked();
    await radio(view, "Day").click();
    await expect(radio(view, "Day")).toBeChecked();
    await expect(radio(view, "Week")).not.toBeChecked();
    // a radio stays checked when clicked again
    await radio(view, "Day").click();
    await expect(radio(view, "Day")).toBeChecked();
    await expect(
      group(page, "sizes", "Small").getByRole("radio", { checked: true })
    ).toHaveCount(0);
  });

  test("single-select with selection required starts checked, and its radios are required", async ({
    page,
  }) => {
    const sort = group(page, "single", "Sort");
    await expect(radio(sort, "Newest")).toBeChecked();
    for (const name of ["Newest", "Oldest", "Popular"])
      await expect(radio(sort, name)).toHaveAttribute("required");
    await expect(radio(sort, "Popular")).toBeDisabled();
  });

  // ADR-0022: a radiogroup is one Tab stop, and the arrow keys move the check
  test("single-select keyboard: Tab lands on the checked radio, and the arrow keys check the next", async ({
    page,
  }) => {
    const view = group(page, "single", "View");
    // Tab in from the section's heading, just before the group
    await page
      .getByTestId("button-group-connected-single")
      .getByRole("heading")
      .evaluate((heading: HTMLElement) => {
        heading.tabIndex = -1;
        heading.focus();
      });
    await page.keyboard.press("Tab");
    await expect(radio(view, "Week")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(radio(view, "Month")).toBeFocused();
    await expect(radio(view, "Month")).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(view.getByRole("radio", { checked: true })).toHaveCount(1);
    await expect(radio(group(page, "single", "Sort"), "Newest")).toBeFocused();
  });

  test("multi-select is a group of native checkboxes, each checked on its own", async ({
    page,
  }) => {
    const filters = group(page, "multi", "Filters", "group");
    await expect(filters.getByRole("radio")).toHaveCount(0);
    await checkbox(filters, "Open").click();
    await expect(checkbox(filters, "Open")).toBeChecked();
    await expect(checkbox(filters, "Assigned")).toBeChecked();
    await checkbox(filters, "Assigned").click();
    await expect(checkbox(filters, "Assigned")).not.toBeChecked();
  });

  // M3's Accessibility page: Tab moves between the buttons, the arrow keys too, and Space selects
  test("multi-select keyboard: Tab and the arrow keys move between checkboxes, skipping disabled, and Space checks", async ({
    page,
  }) => {
    const filters = group(page, "multi", "Filters", "group");
    await checkbox(filters, "Open").focus();
    await page.keyboard.press("Tab");
    await expect(checkbox(filters, "Assigned")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(checkbox(filters, "Closed")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(checkbox(filters, "Closed")).toBeFocused();
    await expect(checkbox(filters, "Closed")).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(checkbox(filters, "Closed")).toBeChecked();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(checkbox(filters, "Open")).toBeFocused();
  });

  test("multi-select with selection required keeps its last checkbox checked", async ({
    page,
  }) => {
    const days = group(page, "multi", "Days", "group");
    await checkbox(days, "Monday").click();
    await expect(checkbox(days, "Monday")).toBeChecked();
    await checkbox(days, "Monday").press("Space");
    await expect(checkbox(days, "Monday")).toBeChecked();
    await checkbox(days, "Tuesday").click();
    await checkbox(days, "Monday").click();
    await expect(checkbox(days, "Monday")).not.toBeChecked();
    await expect(checkbox(days, "Tuesday")).toBeChecked();
  });

  test("submits with its form like radios and checkboxes", async ({ page }) => {
    const entries = () =>
      page
        .locator("#connected-form")
        .evaluate((form: HTMLFormElement) => [...new FormData(form).entries()]);
    expect(await entries()).toEqual([
      ["size", "m"],
      ["toppings", "Cheese"],
      ["toppings", "Basil"],
    ]);
    await radio(group(page, "form", "Size"), "Large").click();
    await checkbox(group(page, "form", "Toppings", "group"), "Olives").click();
    expect(await entries()).toEqual([
      ["size", "l"],
      ["toppings", "Cheese"],
      ["toppings", "Olives"],
      ["toppings", "Basil"],
    ]);
  });

  test("an icon-only option is named by its label, which its tooltip shows on focus", async ({
    page,
  }) => {
    const save = group(page, "multi", "Save", "group");
    const star = checkbox(save, "Star");
    await checkbox(save, "Favorite").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(star).toBeFocused();
    await expect(
      option(star).locator("[data-ac-tooltip][data-shown]")
    ).toHaveText("Star");
    await star.press("Space");
    await expect(star).toBeChecked();
  });

  // M3's Specs: 2px between options at every size, full outer corners and the size's inner ones
  test("joins its options 2px apart, with full outer corners and small inner ones, in all five sizes", async ({
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
      const [first, middle, last] = await options(target).all();
      expect(await corners(first), name).toEqual([full, inner, inner, full]);
      expect(await corners(middle), name).toEqual([inner, inner, inner, inner]);
      expect(await corners(last), name).toEqual([inner, full, full, inner]);
    }
  });

  // M3's Guidelines: a connected group spans its surface, its options sharing the width
  test("spans the width it's in, its options sharing it equally", async ({
    page,
  }) => {
    const target = group(page, "sizes", "Small");
    const sectionWidth = await page
      .getByTestId("button-group-connected-sizes")
      .evaluate((el) => {
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

  // M3's Specs: extra small and small connected groups' options are at least 48px wide
  test("an extra small icon option is at least 48px wide", async ({ page }) => {
    const target = group(page, "sizes", "Extra small icons", "group");
    for (const rect of await boxes(target))
      expect(rect.width).toBeGreaterThanOrEqual(48);
  });

  test("a selected option morphs to full corners", async ({ page }) => {
    for (const { name, full } of SIZES) {
      const [, middle] = await options(group(page, "sizes", name)).all();
      await select(page, middle);
      expect(await corners(middle), name).toEqual([full, full, full, full]);
    }
  });

  // M3: only the pressed option's shape changes, its inner corners narrowing, and its neighbours
  // keep their widths
  test("a pressed option's inner corners narrow, and nothing else moves", async ({
    page,
  }) => {
    for (const { name, full, pressed } of SIZES) {
      const target = group(page, "sizes", name);
      await target.scrollIntoViewIfNeeded();
      const [first, middle] = await options(target).all();
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
  test("a square group's options have the small corners all round, until selected", async ({
    page,
  }) => {
    const target = group(page, "styles", "Square");
    for (const item of await options(target).all())
      expect(await corners(item)).toEqual([8, 8, 8, 8]);
    const first = option(radio(target, "Square one"));
    await select(page, first);
    expect(await corners(first)).toEqual([20, 20, 20, 20]);
  });

  // Button's toggle colors: tonal selects to secondary, filled and elevated to primary, outlined
  // to inverse surface
  test("a selected option takes its style's selected colors, in light and dark", async ({
    page,
  }) => {
    const square = option(radio(group(page, "styles", "Square"), "Square two"));
    await select(page, square);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      for (const [target, container, content] of [
        [
          option(radio(group(page, "single", "View"), "Week")),
          "secondary",
          "on-secondary",
        ],
        [
          option(radio(group(page, "styles", "Filled"), "Filled one")),
          "primary",
          "on-primary",
        ],
        [
          option(radio(group(page, "styles", "Elevated"), "Elevated one")),
          "primary",
          "on-primary",
        ],
        [square, "inverse-surface", "inverse-on-surface"],
      ] as const) {
        await expect(target, scheme).toHaveCSS(
          "background-color",
          await resolvedColor(page, `var(--theme-color-${container})`)
        );
        await expect(target, scheme).toHaveCSS(
          "color",
          await resolvedColor(page, `var(--theme-color-${content})`)
        );
      }
    }
  });

  test("a disabled option looks disabled", async ({ page }) => {
    const popular = option(radio(group(page, "single", "Sort"), "Popular"));
    await expect(popular).toHaveCSS(
      "color",
      await resolvedColor(
        page,
        "color-mix(in oklab, var(--theme-color-on-surface) 38%, transparent)"
      )
    );
  });

  // M3's Accessibility page: the focused option shows its focus indicator, as a Button does
  // Reached with Tab: WebKit doesn't count focus the arrow keys move between radios as
  // :focus-visible, for any radio
  test("a keyboard-focused option shows its focus ring", async ({ page }) => {
    const view = group(page, "single", "View");
    const week = option(radio(view, "Week"));
    expect(await castsNoShadow(week)).toBe(true);
    await radio(group(page, "single", "Sort"), "Newest").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(radio(view, "Week")).toBeFocused();
    await settled(page);
    expect(await castsNoShadow(week)).toBe(false);
  });

  test("right to left, it runs from the right, its full corners on the outside", async ({
    page,
  }) => {
    const target = group(page, "rtl", "Right to left");
    const [first, second] = await boxes(target);
    expect(first.left).toBeGreaterThan(second.left);
    // corners() reads from the start edge, the right one here
    expect(await corners(option(radio(target, "First")))).toEqual([
      20, 8, 8, 20,
    ]);
    const multi = group(page, "rtl", "Right to left multi", "group");
    await checkbox(multi, "One").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(checkbox(multi, "Two")).toBeFocused();
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("a selected option's corners change at once", async ({ page }) => {
      const [, middle] = await options(group(page, "sizes", "Small")).all();
      await middle.click();
      await page.mouse.move(0, 0);
      expect(await corners(middle)).toEqual([20, 20, 20, 20]);
    });
  });
});
