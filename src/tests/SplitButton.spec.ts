import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  castsNoShadow,
  expectFocusRing,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/split-button is a Section with data-testid="split-button-<caseId>"
type SplitCaseId = "menu" | "sizes" | "styles" | "rtl";

const button = (page: Page, caseId: SplitCaseId, name: string) =>
  page
    .getByTestId(`split-button-${caseId}`)
    .getByRole("button", { name, exact: true });

const menu = (page: Page, id: string) => page.locator(`#${id}`);

// The trailing button's menu icon
const menuIcon = (trailing: Locator) =>
  trailing.locator("[data-ac-split-button-part=icon]");

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

// How far the menu icon's center sits from its button's, toward the end edge
const iconOffset = (trailing: Locator) =>
  trailing.evaluate((el) => {
    const icon = el.querySelector("[data-ac-split-button-part=icon]")!;
    const center = (rect: DOMRect) => rect.left + rect.width / 2;
    const offset =
      center(icon.getBoundingClientRect()) - center(el.getBoundingClientRect());
    return getComputedStyle(el).direction === "rtl" ? -offset : offset;
  });

// M3's split button tokens, per size: the height, the outer (full) and inner corners, the inner
// corners hovered, focused or pressed, the leading button's start and end padding, the trailing
// button's width (its padding either side of its icon) and icon size, and how far the menu icon
// sits off center toward the leading button while the menu is closed
const SIZES = [
  {
    name: "Extra small",
    height: 32,
    full: 16,
    inner: 4,
    engaged: 8,
    padding: [12, 10],
    trailingWidth: 48,
    iconSize: 22,
    iconOffset: -1,
  },
  {
    name: "Small",
    height: 40,
    full: 20,
    inner: 4,
    engaged: 12,
    padding: [16, 12],
    trailingWidth: 48,
    iconSize: 22,
    iconOffset: -1,
  },
  {
    name: "Medium",
    height: 56,
    full: 28,
    inner: 4,
    engaged: 12,
    padding: [24, 24],
    trailingWidth: 56,
    iconSize: 26,
    iconOffset: -2,
  },
  {
    name: "Large",
    height: 96,
    full: 48,
    inner: 8,
    engaged: 20,
    padding: [48, 48],
    trailingWidth: 96,
    iconSize: 38,
    iconOffset: -3,
  },
  {
    name: "Extra large",
    height: 136,
    full: 68,
    inner: 12,
    engaged: 20,
    padding: [64, 64],
    trailingWidth: 136,
    iconSize: 50,
    iconOffset: -6,
  },
] as const;

const trailingName = (name: string) => `More ${name.toLowerCase()} options`;

// Opens a menu with a click and waits for the trailing button to settle
const open = async (page: Page, trailing: Locator) => {
  await trailing.click();
  await page.mouse.move(0, 0);
  await settled(page);
};

test.describe("SplitButton", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/split-button");
  });

  test("the leading button is named by its label and the trailing one by menuLabel, declaring its menu", async ({
    page,
  }) => {
    await expect(button(page, "menu", "Watch later")).not.toHaveAttribute(
      "aria-haspopup"
    );
    const trailing = button(page, "menu", "More watch options");
    await expect(trailing).toHaveAttribute("aria-haspopup", "menu");
    await expect(trailing).toHaveAttribute("aria-controls", "watch-menu");
    await expect(trailing).toHaveAttribute("aria-expanded", "false");
    // the menu is named by the trailing button
    await open(page, trailing);
    await expect(
      page.getByRole("menu", { name: "More watch options" })
    ).toBeVisible();
  });

  test("an icon-only leading button is named by its aria-label", async ({
    page,
  }) => {
    await expect(button(page, "menu", "Favorite")).toBeVisible();
    await expect(button(page, "menu", "More favorite options")).toBeVisible();
  });

  // M3's Accessibility page: Tab moves from the leading button to the trailing one
  test("Tab moves from the leading button to the trailing one", async ({
    page,
  }) => {
    await button(page, "menu", "Watch later").focus();
    await page.keyboard.press("Tab");
    await expect(button(page, "menu", "More watch options")).toBeFocused();
  });

  test("the trailing button opens its menu, focusing its first item, and Escape returns focus to it", async ({
    page,
  }) => {
    const trailing = button(page, "menu", "More watch options");
    await trailing.click();
    await expect(menu(page, "watch-menu")).toBeVisible();
    await expect(trailing).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("menuitem", { name: "Watch tonight" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu(page, "watch-menu")).toBeHidden();
    await expect(trailing).toHaveAttribute("aria-expanded", "false");
    await expect(trailing).toBeFocused();
  });

  for (const key of ["Enter", "Space"]) {
    test(`${key} on the trailing button opens its menu`, async ({ page }) => {
      const trailing = button(page, "menu", "More watch options");
      await trailing.focus();
      await page.keyboard.press(key);
      await expect(
        page.getByRole("menuitem", { name: "Watch tonight" })
      ).toBeFocused();
    });
  }

  test("the leading button doesn't open the menu", async ({ page }) => {
    await button(page, "menu", "Watch later").click();
    await expect(menu(page, "watch-menu")).toBeHidden();
  });

  // M3's Guidelines: the menu lines up with the trailing button's start edge, 4px below
  test("the menu opens 4px below the trailing button, lined up with its start edge", async ({
    page,
  }) => {
    const trailing = button(page, "menu", "More watch options");
    await open(page, trailing);
    const [trigger, popup] = [
      await box(trailing),
      await box(menu(page, "watch-menu")),
    ];
    expect(popup.y - (trigger.y + trigger.height)).toBeCloseTo(4, 0);
    expect(popup.x).toBeCloseTo(trigger.x, 0);
  });

  test("a disabled split button disables both buttons", async ({ page }) => {
    const send = button(page, "menu", "Send");
    const trailing = button(page, "menu", "More send options");
    await expect(send).toBeDisabled();
    await expect(trailing).toBeDisabled();
    const disabledLabel = await resolvedColor(
      page,
      "color-mix(in oklab, var(--theme-color-on-surface) 38%, transparent)"
    );
    await expect(send).toHaveCSS("color", disabledLabel);
    await expect(trailing).toHaveCSS("color", disabledLabel);
  });

  for (const size of SIZES) {
    test(`${size.name}: M3's height, 2px gap, corners, padding and menu button`, async ({
      page,
    }) => {
      const leading = button(page, "sizes", size.name);
      const trailing = button(page, "sizes", trailingName(size.name));
      const [lead, trail] = [await box(leading), await box(trailing)];
      expect(lead.height).toBeCloseTo(size.height, 0);
      expect(trail.height).toBeCloseTo(size.height, 0);
      expect(trail.width).toBeCloseTo(size.trailingWidth, 0);
      expect(trail.x - (lead.x + lead.width)).toBeCloseTo(2, 0);
      expect(await corners(leading)).toEqual([
        size.full,
        size.inner,
        size.inner,
        size.full,
      ]);
      expect(await corners(trailing)).toEqual([
        size.inner,
        size.full,
        size.full,
        size.inner,
      ]);
      await expect(leading).toHaveCSS(
        "padding-inline-start",
        `${size.padding[0]}px`
      );
      await expect(leading).toHaveCSS(
        "padding-inline-end",
        `${size.padding[1]}px`
      );
      const icon = await box(menuIcon(trailing));
      expect(icon.width).toBeCloseTo(size.iconSize, 0);
      expect(await iconOffset(trailing)).toBeCloseTo(size.iconOffset, 0);
    });
  }

  // M3's Specs: the inner corners widen while a button is hovered, focused or pressed; the outer
  // ones stay full
  test("a hovered, focused or pressed button's inner corners widen", async ({
    page,
  }) => {
    const { full, inner, engaged } = SIZES[1];
    const leading = button(page, "sizes", "Small");
    const trailing = button(page, "sizes", trailingName("Small"));
    await leading.hover();
    await settled(page);
    expect(await corners(leading)).toEqual([full, engaged, engaged, full]);
    expect(await corners(trailing)).toEqual([inner, full, full, inner]);

    await trailing.hover();
    await page.mouse.down();
    await settled(page);
    expect(await corners(trailing)).toEqual([engaged, full, full, engaged]);
    await page.mouse.move(0, 0);
    await page.mouse.up();

    await leading.focus();
    await page.keyboard.press("Tab");
    await settled(page);
    expect(await corners(trailing)).toEqual([engaged, full, full, engaged]);
  });

  // M3's Specs and Guidelines: while its menu is open the trailing button is fully round, its icon
  // centered and turned 180° toward the leading button
  for (const size of [SIZES[1], SIZES[4]]) {
    test(`${size.name}: an open menu's trailing button turns round, its icon centered and turned`, async ({
      page,
    }) => {
      const trailing = button(page, "sizes", trailingName(size.name));
      await expect(menuIcon(trailing)).toHaveCSS("rotate", "none");
      await open(page, trailing);
      const { full } = size;
      expect(await corners(trailing)).toEqual([full, full, full, full]);
      expect(await iconOffset(trailing)).toBeCloseTo(0, 0);
      await expect(menuIcon(trailing)).toHaveCSS("rotate", "180deg");
    });
  }

  // A click leaves the pointer on the button, and hovered corners mustn't win over the open ones
  test("an open menu's trailing button stays round with the pointer still on it", async ({
    page,
  }) => {
    const trailing = button(page, "sizes", trailingName("Small"));
    await trailing.click();
    await settled(page);
    expect(await corners(trailing)).toEqual([20, 20, 20, 20]);
  });

  // M3's Specs: the same colors as Buttons; an open menu's trailing button keeps a pressed state
  // layer rather than a selected color
  test("each style takes Button's colors, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      for (const [name, container, content] of [
        ["Elevated", "surface-container-low", "primary"],
        ["Filled", "primary", "on-primary"],
        ["Tonal", "secondary-container", "on-secondary-container"],
        ["Outlined", "", "on-surface-variant"],
      ] as const) {
        for (const target of [
          button(page, "styles", name),
          button(page, "styles", trailingName(name)),
        ]) {
          await expect(target, `${scheme} ${name}`).toHaveCSS(
            "background-color",
            container
              ? await resolvedColor(page, `var(--theme-color-${container})`)
              : "rgba(0, 0, 0, 0)"
          );
          await expect(target, `${scheme} ${name}`).toHaveCSS(
            "color",
            await resolvedColor(page, `var(--theme-color-${content})`)
          );
        }
      }
    }
    const outlined = button(page, "styles", "Outlined");
    await expect(outlined).toHaveCSS(
      "border-color",
      await resolvedColor(page, "var(--theme-color-outline-variant)")
    );
    await expect(outlined).toHaveCSS("border-top-width", "1px");
  });

  test("an open menu's trailing button keeps its color, with a pressed state layer", async ({
    page,
  }) => {
    const trailing = button(page, "styles", trailingName("Tonal"));
    const background = await resolvedColor(
      page,
      "var(--theme-color-secondary-container)"
    );
    await open(page, trailing);
    await expect(trailing).toHaveCSS("background-color", background);
    await expect
      .poll(() =>
        trailing.evaluate((el) => getComputedStyle(el, "::before").opacity)
      )
      .toBe("0.1");
  });

  test("elevated buttons cast M3's level 1 shadow; the others none", async ({
    page,
  }) => {
    expect(await castsNoShadow(button(page, "styles", "Elevated"))).toBe(false);
    expect(
      await castsNoShadow(button(page, "styles", trailingName("Elevated")))
    ).toBe(false);
    expect(await castsNoShadow(button(page, "styles", "Tonal"))).toBe(true);
  });

  // M3's Accessibility page: each button is at least 48px tall to touch
  test("an extra small split button's buttons have 48px touch targets", async ({
    page,
  }) => {
    for (const name of ["Extra small", trailingName("Extra small")]) {
      const height = await button(page, "sizes", name).evaluate(
        (el) => getComputedStyle(el, "::after").height
      );
      expect(parseFloat(height)).toBe(48);
    }
  });

  test("a keyboard-focused button shows its focus ring", async ({ page }) => {
    await button(page, "menu", "Watch later").focus();
    await page.keyboard.press("Tab");
    await expectFocusRing(button(page, "menu", "More watch options"));
  });

  test("right to left, it's mirrored: the trailing button on the left, its icon turning the other way", async ({
    page,
  }) => {
    const leading = button(page, "rtl", "حفظ");
    const trailing = button(page, "rtl", "خيارات أخرى");
    const [lead, trail] = [await box(leading), await box(trailing)];
    expect(trail.x + trail.width).toBeLessThan(lead.x);
    // corners() reads from the start edge, the right one here
    expect(await corners(leading)).toEqual([20, 4, 4, 20]);
    expect(await corners(trailing)).toEqual([4, 20, 20, 4]);
    expect(await iconOffset(trailing)).toBeCloseTo(-1, 0);
    await open(page, trailing);
    await expect(menuIcon(trailing)).toHaveCSS("rotate", "-180deg");
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("an open menu's trailing button turns round and its icon turns at once", async ({
      page,
    }) => {
      const trailing = button(page, "sizes", trailingName("Small"));
      await trailing.click();
      await page.mouse.move(0, 0);
      expect(await corners(trailing)).toEqual([20, 20, 20, 20]);
      await expect(menuIcon(trailing)).toHaveCSS("rotate", "180deg");
      expect(
        await menuIcon(trailing).evaluate(
          (el) => getComputedStyle(el).transitionDuration
        )
      ).toBe("0s");
    });
  });
});
