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
  textBox,
} from "./support/helpers";

// Each case on /tests/chip-filter is a Section with data-testid="chip-filter-<caseId>"
type ChipCaseId = "styles" | "icon" | "disabled" | "menu" | "rtl";

const chip = (page: Page, caseId: ChipCaseId, name: string) =>
  page
    .getByTestId(`chip-filter-${caseId}`)
    .getByRole("button", { name, exact: true });

const part = (target: Locator, name: "leading" | "icon" | "check") =>
  target.locator(`[data-ac-chip-filter-part=${name}]`);

const trailingIcon = (target: Locator) =>
  target.locator("[data-ac-base-chip-part=trailing-icon]");

const stateLayer = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el, "::before").getPropertyValue(p),
    property
  );

const shadowOf = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el).boxShadow);

// How far the label's text starts from the chip's start edge, and ends from its end edge, rounded:
// Firefox and WebKit measure text to a fraction of a pixel
const labelInsets = async (target: Locator) => {
  await settled(target.page());
  const outer = await box(target);
  const text = await textBox(target);
  const rtl = await target.evaluate(
    (el) => getComputedStyle(el).direction === "rtl"
  );
  const left = text.x - outer.x;
  const right = outer.x + outer.width - (text.x + text.width);
  return (rtl ? [right, left] : [left, right]).map(Math.round);
};

test.describe("ChipFilter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/chip-filter");
  });

  // M3's Accessibility page: a selectable chip; the web's toggle button, with its pressed state
  test("is a toggle button named by its label, its icons hidden", async ({
    page,
  }) => {
    const unselected = chip(page, "styles", "Docs");
    await expect(unselected).toHaveJSProperty("tagName", "BUTTON");
    await expect(unselected).toHaveAttribute("type", "button");
    await expect(unselected).toHaveAttribute("aria-pressed", "false");
    await expect(chip(page, "styles", "Slides")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const withIcon = chip(page, "icon", "Images");
    await expect(part(withIcon, "icon")).toHaveAttribute("aria-hidden", "true");
    await expect(part(withIcon, "check")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  // M3's Accessibility page: Space or Enter selects or deselects the focused chip
  test("a click, Space or Enter selects and deselects it", async ({ page }) => {
    const target = chip(page, "styles", "Docs");
    await target.click();
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await target.click();
    await expect(target).toHaveAttribute("aria-pressed", "false");
    await target.focus();
    await page.keyboard.press("Space");
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(target).toHaveAttribute("aria-pressed", "false");
  });

  test("a disabled chip can't be selected", async ({ page }) => {
    const target = chip(page, "disabled", "Flat disabled");
    await expect(target).toBeDisabled();
    await target.click({ force: true });
    await expect(target).toHaveAttribute("aria-pressed", "false");
  });

  // M3's Guidelines: selecting a filter chip appends a leading check mark. M3's Specs: 32dp tall,
  // 8dp corners, 16dp padding, 8dp on an icon's side, an 18dp icon 8dp from the label, Label Large
  test("selected, it gains a leading check mark, with M3's measurements", async ({
    page,
  }) => {
    const target = chip(page, "styles", "Docs");
    await expect(target).toHaveCSS("height", "32px");
    await expect(target).toHaveCSS("border-top-left-radius", "8px");
    await expect(target).toHaveCSS("font-size", "14px");
    await expect(target).toHaveCSS("line-height", "20px");
    await expect(target).toHaveCSS("font-weight", "500");
    await expect(target).toHaveCSS("letter-spacing", "0.1px");
    expect(await labelInsets(target)).toEqual([16, 16]);
    await expect(part(target, "check")).toHaveCSS("opacity", "0");

    await target.click();
    expect(await labelInsets(target)).toEqual([34, 16]);
    const check = await box(part(target, "check"));
    expect([check.width, check.height]).toEqual([18, 18]);
    expect(check.x - (await box(target)).x).toBeCloseTo(8, 0);
    await expect(part(target, "check")).toHaveCSS("opacity", "1");
  });

  // Compose's FilterChip samples: the check mark takes the leading icon's place while selected
  test("a leading icon gives way to the check mark while selected", async ({
    page,
  }) => {
    const target = chip(page, "icon", "Images");
    expect(await labelInsets(target)).toEqual([34, 16]);
    await expect(part(target, "icon")).toHaveCSS("opacity", "1");
    await expect(part(target, "check")).toHaveCSS("opacity", "0");
    await target.click();
    await settled(page);
    expect(await labelInsets(target)).toEqual([34, 16]);
    await expect(part(target, "icon")).toHaveCSS("opacity", "0");
    await expect(part(target, "check")).toHaveCSS("opacity", "1");
  });

  // M3's Specs and Compose's FilterChipTokens: unselected, a flat chip sits on an outline-variant
  // outline and an elevated one on surface-container-low, the label on-surface-variant and the
  // icon primary; selected, both are secondary-container, with no outline, and their label and
  // check mark on-secondary-container
  test("each style takes M3's colors, selected and not, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const role = (name: string) =>
        resolvedColor(page, `var(--theme-color-${name})`);
      const transparent = "rgba(0, 0, 0, 0)";

      const flat = chip(page, "styles", "Docs");
      await expect(flat).toHaveCSS("background-color", transparent);
      await expect(flat).toHaveCSS(
        "border-top-color",
        await role("outline-variant")
      );
      await expect(flat).toHaveCSS("border-top-width", "1px");
      await expect(flat).toHaveCSS("color", await role("on-surface-variant"));
      expect(await castsNoShadow(flat)).toBe(true);
      await expect(part(chip(page, "icon", "Images"), "icon")).toHaveCSS(
        "color",
        await role("primary")
      );

      for (const name of ["Slides", "Forms"]) {
        const selected = chip(page, "styles", name);
        await expect(selected).toHaveCSS(
          "background-color",
          await role("secondary-container")
        );
        await expect(selected).toHaveCSS("border-top-color", transparent);
        await expect(selected).toHaveCSS(
          "color",
          await role("on-secondary-container")
        );
        await expect(part(selected, "check")).toHaveCSS(
          "color",
          await role("on-secondary-container")
        );
      }
      expect(await castsNoShadow(chip(page, "styles", "Slides"))).toBe(true);

      const elevated = chip(page, "styles", "Sheets");
      await expect(elevated).toHaveCSS(
        "background-color",
        await role("surface-container-low")
      );
      await expect(elevated).toHaveCSS("border-top-color", transparent);
      await expect(elevated).toHaveCSS(
        "color",
        await role("on-surface-variant")
      );
      for (const name of ["Sheets", "Forms"]) {
        expect(await shadowOf(chip(page, "styles", name))).toContain(
          await elevation(page, 1)
        );
      }
    }
  });

  // M3's Specs: the state layer is the label's color, 8% hovered and 10% focused or pressed
  test("its state layer follows the label's color, selected or not", async ({
    page,
  }) => {
    for (const [name, role] of [
      ["Docs", "on-surface-variant"],
      ["Slides", "on-secondary-container"],
    ]) {
      const target = chip(page, "styles", name);
      await target.hover();
      await expect.poll(() => stateLayer(target, "opacity")).toBe("0.08");
      expect(await stateLayer(target, "background-color")).toBe(
        await resolvedColor(page, `var(--theme-color-${role})`)
      );
      await page.mouse.down();
      await expect.poll(() => stateLayer(target, "opacity")).toBe("0.1");
      await page.mouse.up();
      await page.mouse.move(0, 0);
    }
  });

  // Compose's FilterChipTokens: a flat chip rises to level 1 on hover only while selected, and is
  // flat again pressed
  test("a selected flat chip rises to level 1 on hover, not while pressed", async ({
    page,
  }) => {
    const unselected = chip(page, "styles", "Docs");
    await unselected.hover();
    await settled(page);
    expect(await castsNoShadow(unselected)).toBe(true);

    const selected = chip(page, "styles", "Slides");
    await selected.hover();
    await expect
      .poll(() => shadowOf(selected))
      .toContain(await elevation(page, 1));
    await page.mouse.down();
    await expect.poll(() => castsNoShadow(selected)).toBe(true);
    await page.mouse.up();
  });

  // M3's Specs: a focused unselected flat chip's outline turns on-surface-variant, the label's
  // color; a selected one keeps no outline
  test("keyboard-focused, it shows the focus ring, and only an unselected flat chip an outline", async ({
    page,
  }) => {
    const unselected = chip(page, "styles", "Docs");
    await chip(page, "styles", "Slides").focus();
    await page.keyboard.press("Shift+Tab");
    await expectFocusRing(unselected);
    await expect(unselected).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
    await page.keyboard.press("Tab");
    const selected = chip(page, "styles", "Slides");
    await expectFocusRing(selected);
    await expect(selected).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  });

  // M3's Specs: the label and icons on-surface at 38%; unselected, a flat outline on-surface at
  // 12%; selected, the container on-surface at 12% and no outline
  test("disabled, it takes M3's disabled colors, selected or not", async ({
    page,
  }) => {
    const flat = chip(page, "disabled", "Flat disabled");
    const selected = chip(page, "disabled", "Selected disabled");
    const elevated = chip(page, "disabled", "Elevated selected disabled");
    for (const [target, property, opacity] of [
      [flat, "color", 0.38],
      [flat, "border-top-color", 0.12],
      [flat, "background-color", 0],
      [selected, "color", 0.38],
      [part(selected, "check"), "color", 0.38],
      [selected, "background-color", 0.12],
      [selected, "border-top-color", 0],
      [elevated, "color", 0.38],
      [elevated, "background-color", 0.12],
    ] as const) {
      await expect
        .poll(async () => alpha(await css(target, property)))
        .toBeCloseTo(opacity, 2);
    }
    expect(await castsNoShadow(elevated)).toBe(true);
  });

  // M3's Guidelines: a filter chip with a trailing icon can open a menu; in compact windows the
  // whole chip must open it, so the whole chip is the menu button
  test("with a menu, it's a menu button with a trailing dropdown icon, not a toggle", async ({
    page,
  }) => {
    const target = chip(page, "menu", "Price");
    await expect(target).not.toHaveAttribute("aria-pressed");
    await expect(target).toHaveAttribute("aria-haspopup", "menu");
    await expect(target).toHaveAttribute("aria-controls", "price-menu");
    await expect(target).toHaveAttribute("aria-expanded", "false");
    const icon = await box(trailingIcon(target));
    expect([icon.width, icon.height]).toEqual([18, 18]);
    await expect(trailingIcon(target).locator("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    await expect(trailingIcon(target)).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
    // M3's Specs: 8dp on the trailing icon's side
    expect(await labelInsets(target)).toEqual([16, 34]);
    expect((await box(target)).x + (await box(target)).width).toBeCloseTo(
      icon.x + icon.width + 8,
      0
    );
  });

  test("with a menu, it opens the menu, keeps the pressed state layer while it's open, and Escape returns focus", async ({
    page,
  }) => {
    const target = chip(page, "menu", "Price");
    await target.click();
    await expect(page.locator("#price-menu")).toBeVisible();
    await expect(target).toHaveAttribute("aria-expanded", "true");
    await expect(target).not.toHaveAttribute("aria-pressed");
    await page.mouse.move(0, 0);
    await expect.poll(() => stateLayer(target, "opacity")).toBe("0.1");
    await expect(
      page.getByRole("menuitemradio", { name: "Under $50" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#price-menu")).toBeHidden();
    await expect(target).toBeFocused();
  });

  // A menu chip's selection is the filter its menu set, given by `isSelected`, as it has no
  // pressed state of its own
  test("with a menu and selected, it takes the selected colors and check mark", async ({
    page,
  }) => {
    const target = chip(page, "menu", "2+ bedrooms");
    await expect(target).not.toHaveAttribute("aria-pressed");
    await expect(target).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-secondary-container)")
    );
    await expect(trailingIcon(target)).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-secondary-container)")
    );
    await expect(part(target, "check")).toHaveCSS("opacity", "1");
    expect(await labelInsets(target)).toEqual([34, 34]);
    // clicking opens the menu; it doesn't toggle the selection
    await target.click();
    await expect(target).toHaveAttribute("data-ac-chip-filter-selected", "");
    await page.keyboard.press("Escape");
  });

  // The menu button pattern: ArrowDown and ArrowUp open the menu on its first and last item, and
  // the chips' arrow keys leave them to it
  for (const [key, item] of [
    ["ArrowDown", "Under $50"],
    ["ArrowUp", "Over $100"],
  ] as const) {
    test(`with a menu, ${key} opens it on the ${key === "ArrowDown" ? "first" : "last"} item, rather than moving to the next chip`, async ({
      page,
    }) => {
      await chip(page, "menu", "Price").focus();
      await page.keyboard.press(key);
      await expect(page.locator("#price-menu")).toBeVisible();
      await expect(
        page.getByRole("menuitemradio", { name: item })
      ).toBeFocused();
    });
  }

  test("a disabled menu chip doesn't open its menu", async ({ page }) => {
    const target = chip(page, "menu", "Type");
    await expect(target).toBeDisabled();
    await target.click({ force: true });
    await expect(page.locator("#type-menu")).toBeHidden();
  });

  test("has a 48px touch target", async ({ page }) => {
    const target = chip(page, "styles", "Docs");
    const size = await target.evaluate((el) => {
      const style = getComputedStyle(el, "::after");
      return [parseFloat(style.width), parseFloat(style.height)];
    });
    expect(size[1]).toBe(48);
    expect(size[0]).toBeGreaterThanOrEqual(48);
  });

  // M3's Accessibility page: the arrow keys move between the chips in a set, menu chips too
  test("the arrow keys move between the chips in a set", async ({ page }) => {
    await chip(page, "styles", "Docs").focus();
    await page.keyboard.press("ArrowRight");
    await expect(chip(page, "styles", "Slides")).toBeFocused();
    await chip(page, "menu", "Price").focus();
    await page.keyboard.press("ArrowRight");
    await expect(chip(page, "menu", "2+ bedrooms")).toBeFocused();
  });

  test("right to left, the check mark leads on the right and the dropdown icon trails on the left", async ({
    page,
  }) => {
    const selected = chip(page, "rtl", "مستندات");
    const [chipBox, checkBox] = [
      await box(selected),
      await box(part(selected, "check")),
    ];
    expect(
      chipBox.x + chipBox.width - (checkBox.x + checkBox.width)
    ).toBeCloseTo(8, 0);
    expect(await labelInsets(selected)).toEqual([34, 16]);

    const menuChip = chip(page, "rtl", "السعر");
    const [menuBox, iconBox] = [
      await box(menuChip),
      await box(trailingIcon(menuChip)),
    ];
    expect(iconBox.x - menuBox.x).toBeCloseTo(8, 0);
    expect(await labelInsets(menuChip)).toEqual([16, 34]);
  });
});
