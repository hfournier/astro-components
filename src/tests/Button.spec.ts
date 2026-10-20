import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, expectFocusRing, resolvedColor } from "./support/helpers";

const VARIANTS = ["Elevated", "Filled", "Tonal", "Outlined", "Text"] as const;

// M3's small button height, the default size
const SMALL_HEIGHT = 40;

// M3 Expressive's five sizes. The sizes case holds, per size, a filled round Button named `name`,
// and `<name> square`, `<name> outlined` and `<name> icon` (with a leading icon). font is the
// label's size, line height and weight.
const SIZES = [
  {
    name: "Extra small",
    height: 32,
    padding: 12,
    icon: 20,
    gap: 4,
    font: [14, 20, 500],
    square: 12,
    pressed: 8,
    outline: 1,
  },
  {
    name: "Small",
    height: 40,
    padding: 16,
    icon: 20,
    gap: 8,
    font: [14, 20, 500],
    square: 12,
    pressed: 8,
    outline: 1,
  },
  {
    name: "Medium",
    height: 56,
    padding: 24,
    icon: 24,
    gap: 8,
    font: [16, 24, 500],
    square: 16,
    pressed: 12,
    outline: 1,
  },
  {
    name: "Large",
    height: 96,
    padding: 48,
    icon: 32,
    gap: 12,
    font: [24, 32, 400],
    square: 28,
    pressed: 16,
    outline: 2,
  },
  {
    name: "Extra large",
    height: 136,
    padding: 64,
    icon: 40,
    gap: 16,
    font: [32, 40, 400],
    square: 28,
    pressed: 16,
    outline: 3,
  },
] as const;

const TOGGLE_VARIANTS = ["Elevated", "Filled", "Tonal", "Outlined"] as const;

// Each case on /tests/button is a Section with data-testid="button-<caseId>". The default case
// holds every variant with no size, the disabled case every variant disabled. The toggle cases
// hold an unselected, a selected, and a selected and disabled toggle of each style but text; the
// unselected case also holds a "Favorite" toggle with a selectedIcon and a "Square" one.
type ButtonCaseId =
  | "default"
  | "sizes"
  | "icon-rtl"
  | "disabled"
  | "fullwidth"
  | "no-props"
  | "shape"
  | "as-anchor"
  | "label-on-own-line"
  | "toggle"
  | "toggle-selected"
  | "toggle-disabled"
  | "long-label";

const buttonCase = (page: Page, caseId: ButtonCaseId) =>
  page.getByTestId(`button-${caseId}`);
const button = (page: Page, caseId: ButtonCaseId, name: string) =>
  buttonCase(page, caseId).getByRole("button", { name, exact: true });

// Button as="a" renders a real anchor, so its role is "link"
const anchorButton = (
  page: Page,
  caseId: ButtonCaseId = "as-anchor",
  name = "Anchor button"
) => buttonCase(page, caseId).getByRole("link", { name, exact: true });

// The alpha of a computed color: M3's disabled colors are on-surface at 38% / 10%, which
// Tailwind's `/38` and `/10` modifiers mix in oklab, so the channels are compared by alpha only.
const alpha = (color: string): number => {
  const match =
    color.match(/\/\s*([\d.]+)\)$/) ?? color.match(/rgba\(.*,\s*([\d.]+)\)$/);
  return match ? parseFloat(match[1]!) : 1;
};

const stateLayerOpacity = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el, "::before").opacity);

const css = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );
const px = async (target: Locator, property: string) =>
  parseFloat(await css(target, property));

const role = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

// The label's text, measured as a range, since it's a text node rather than an element
const labelBox = (target: Locator) =>
  target.evaluate((el) => {
    const text = [...el.childNodes].findLast(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()
    )!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const { left, right } = range.getBoundingClientRect();
    return { left, right };
  });

test.describe("Button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/button");
  });

  test("defaults to the filled variant, round shape and small size", async ({
    page,
  }) => {
    const usage = button(page, "no-props", "Primary Button");
    const filled = button(page, "sizes", "Small");

    for (const property of [
      "background-color",
      "color",
      "min-height",
      "border-top-left-radius",
    ]) {
      const expected = await filled.evaluate(
        (el, p) => getComputedStyle(el).getPropertyValue(p),
        property
      );
      await expect(usage).toHaveCSS(property, expected);
    }
    await expect(usage).toHaveAttribute("type", "button");
  });

  test("each variant resolves its M3 color roles", async ({ page }) => {
    const role = (name: string) =>
      resolvedColor(page, `var(--theme-color-${name})`);
    const transparent = "rgba(0, 0, 0, 0)";

    const filled = button(page, "default", "Filled");
    await expect(filled).toHaveCSS("background-color", await role("primary"));
    await expect(filled).toHaveCSS("color", await role("on-primary"));

    const tonal = button(page, "default", "Tonal");
    await expect(tonal).toHaveCSS(
      "background-color",
      await role("secondary-container")
    );
    await expect(tonal).toHaveCSS(
      "color",
      await role("on-secondary-container")
    );

    const elevated = button(page, "default", "Elevated");
    await expect(elevated).toHaveCSS(
      "background-color",
      await role("surface-container-low")
    );
    await expect(elevated).toHaveCSS("color", await role("primary"));
    expect(
      await elevated.evaluate((el) => getComputedStyle(el).boxShadow)
    ).toMatch(/0px 1px 2px 0px/);

    const outlined = button(page, "default", "Outlined");
    await expect(outlined).toHaveCSS("background-color", transparent);
    await expect(outlined).toHaveCSS(
      "border-top-color",
      await role("outline-variant")
    );
    await expect(outlined).toHaveCSS("color", await role("on-surface-variant"));

    const text = button(page, "default", "Text");
    await expect(text).toHaveCSS("background-color", transparent);
    await expect(text).toHaveCSS("border-top-color", transparent);
    await expect(text).toHaveCSS("color", await role("primary"));
  });

  test("disabled buttons use M3's on-surface 38% label and 10% container, and outlined keeps its outline", async ({
    page,
  }) => {
    for (const name of VARIANTS) {
      const target = button(page, "disabled", name);
      await expect(target).toHaveCSS("cursor", "default");

      const style = await target.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          color: s.color,
          background: s.backgroundColor,
          border: s.borderTopColor,
          shadow: s.boxShadow,
        };
      });
      expect(alpha(style.color)).toBeCloseTo(0.38, 2);

      if (name === "Outlined") {
        expect(style.border).toBe(await role(page, "outline-variant"));
      } else if (name !== "Text") {
        expect(alpha(style.background)).toBeCloseTo(0.1, 2);
      }
      expect(style.shadow).not.toMatch(/0px 1px 2px 0px/);
    }
  });

  test("hovering shows the M3 state layer, but not on a disabled button", async ({
    page,
  }) => {
    for (const name of VARIANTS) {
      const target = button(page, "default", name);
      await target.hover();
      await expect.poll(() => stateLayerOpacity(target)).toBe("0.08");
    }

    const disabled = button(page, "disabled", "Filled");
    await disabled.hover({ force: true });
    await expect.poll(() => stateLayerOpacity(disabled)).toBe("0");
  });

  test("the elevated button's shadow rises on hover", async ({ page }) => {
    const elevated = button(page, "default", "Elevated");
    const resting = await elevated.evaluate(
      (el) => getComputedStyle(el).boxShadow
    );

    await elevated.hover();
    await expect
      .poll(() => elevated.evaluate((el) => getComputedStyle(el).boxShadow))
      .not.toBe(resting);
  });

  for (const name of VARIANTS) {
    test(`hovering "${name}" passes color contrast`, async ({ page }) => {
      await button(page, "default", name).hover();
      // The a11y fixture's automatic axe scan (ADR-0002) runs after this test body,
      // while this button is still hovered, and catches any hover-state contrast violation.
    });
  }

  test("focus shows the state layer and the focus ring", async ({ page }) => {
    for (const name of VARIANTS) {
      const target = button(page, "default", name);
      await target.focus();
      await expectFocusRing(target);
      // the state layer transitions in, so poll
      await expect.poll(() => stateLayerOpacity(target)).toBe("0.1");
    }
  });

  for (const size of SIZES) {
    test(`${size.name} is M3's ${size.height}px button, with its padding and label type`, async ({
      page,
    }) => {
      const target = button(page, "sizes", size.name);
      expect((await box(target)).height).toBe(size.height);
      expect(await px(target, "padding-inline-start")).toBe(size.padding);
      expect(await px(target, "padding-inline-end")).toBe(size.padding);
      const [fontSize, lineHeight, weight] = size.font;
      expect(await px(target, "font-size")).toBe(fontSize);
      expect(await px(target, "line-height")).toBe(lineHeight);
      expect(await css(target, "font-weight")).toBe(String(weight));
    });

    test(`${size.name}: round is half its height, square is M3's ${size.square}px corner`, async ({
      page,
    }) => {
      const round = button(page, "sizes", size.name);
      expect(await px(round, "border-top-left-radius")).toBe(size.height / 2);
      const square = button(page, "sizes", `${size.name} square`);
      expect(await px(square, "border-top-left-radius")).toBe(size.square);
    });

    test(`${size.name}: pressing round or square morphs to M3's ${size.pressed}px corner`, async ({
      page,
    }) => {
      for (const name of [size.name, `${size.name} square`]) {
        const target = button(page, "sizes", name);
        await target.hover();
        await page.mouse.down();
        await expect
          .poll(() => px(target, "border-top-left-radius"))
          .toBe(size.pressed);
        await page.mouse.up();
      }
    });

    test(`${size.name}: the outline is ${size.outline}px, with the state layer inset to match`, async ({
      page,
    }) => {
      const outlined = button(page, "sizes", `${size.name} outlined`);
      expect(await px(outlined, "border-top-width")).toBe(size.outline);
      const stateLayerInset = await outlined.evaluate((el) =>
        parseFloat(getComputedStyle(el, "::before").top)
      );
      expect(stateLayerInset).toBe(-size.outline);
    });

    test(`${size.name}: a leading icon is ${size.icon}px, ${size.gap}px before the label`, async ({
      page,
    }) => {
      const target = button(page, "sizes", `${size.name} icon`);
      const icon = await box(target.locator("svg"));
      expect(icon.width).toBeCloseTo(size.icon, 2);
      expect(icon.height).toBeCloseTo(size.icon, 2);
      const label = await labelBox(target);
      expect(label.left - (icon.x + icon.width)).toBeCloseTo(size.gap, 0);
      // the icon and label are grouped and centered, between equal padding
      const outer = await box(target);
      expect(icon.x - outer.x).toBeCloseTo(
        outer.x + outer.width - label.right,
        0
      );
    });
  }

  test("right to left, the leading icon goes after the label, on the right", async ({
    page,
  }) => {
    const target = button(page, "icon-rtl", "Add");
    const icon = await box(target.locator("svg"));
    const label = await labelBox(target);
    expect(icon.x).toBeGreaterThan(label.right);
    expect(icon.x - label.right).toBeCloseTo(8, 0);
  });

  test("the icon is decorative, so the label alone names the button", async ({
    page,
  }) => {
    const target = button(page, "sizes", "Small icon");
    await expect(target.locator("svg")).toHaveAttribute("aria-hidden", "true");
  });

  for (const name of ["Extra small", "Small"]) {
    test(`${name} keeps a 48px touch target`, async ({ page }) => {
      const target = button(page, "sizes", name);
      const targetHeight = await target.evaluate((el) =>
        parseFloat(getComputedStyle(el, "::after").height)
      );
      expect(targetHeight).toBeGreaterThanOrEqual(48);
    });
  }

  for (const name of ["Filled", "Tonal"] as const) {
    test(`hovering "${name}" raises it to elevation 1`, async ({ page }) => {
      const target = button(page, "default", name);
      expect(await css(target, "box-shadow")).toBe("none");
      await target.hover();
      await expect
        .poll(() => css(target, "box-shadow"))
        .toMatch(/0px 1px 2px 0px/);
    });
  }

  test("the label never wraps, so the button grows to fit it", async ({
    page,
  }) => {
    const target = button(page, "long-label", "Download the full report");
    const outer = await box(target);
    expect(outer.height).toBe(SMALL_HEIGHT);
    // wider than its 96px container, with the label between the 16px paddings
    const label = await labelBox(target);
    expect(outer.width).toBeGreaterThan(96);
    expect(label.left - outer.x).toBeCloseTo(17, 0);
    expect(outer.x + outer.width - label.right).toBeCloseTo(17, 0);
  });

  test("showFullwidth stretches to the width of its container", async ({
    page,
  }) => {
    const target = button(page, "fullwidth", "Filled");
    const [width, containerWidth] = await target.evaluate((el) => {
      const parent = getComputedStyle(el.parentElement!);
      return [
        el.getBoundingClientRect().width,
        el.parentElement!.getBoundingClientRect().width -
          parseFloat(parent.paddingLeft) -
          parseFloat(parent.paddingRight) -
          parseFloat(parent.borderLeftWidth) -
          parseFloat(parent.borderRightWidth),
      ];
    });
    expect(width).toBeCloseTo(containerWidth, 0);
  });

  test('as="a" renders a real anchor, styled identically to the default button', async ({
    page,
  }) => {
    const anchor = anchorButton(page);

    await expect(anchor).toBeVisible();
    await expect(anchor).toHaveJSProperty("tagName", "A");
    await expect(anchor).toHaveAttribute("href", "#");
    // `type` is only defaulted on a real <button>
    await expect(anchor).not.toHaveAttribute("type", /.*/);

    const filled = button(page, "default", "Filled");
    for (const property of ["background-color", "color", "min-height"]) {
      const expected = await filled.evaluate(
        (el, p) => getComputedStyle(el).getPropertyValue(p),
        property
      );
      await expect(anchor).toHaveCSS(property, expected);
    }
  });

  test('as="a" shows the same focus ring', async ({ page }) => {
    await anchorButton(page).focus();
    await expectFocusRing(anchorButton(page));
  });

  test("a label on its own line in MDX renders without a paragraph", async ({
    page,
  }) => {
    const multiLine = [
      anchorButton(page, "label-on-own-line", "Multi-line anchor button"),
      button(page, "label-on-own-line", "Multi-line button"),
    ];
    for (const target of multiLine) {
      await expect(target.locator("p")).toHaveCount(0);
      expect((await box(target)).height).toBe(SMALL_HEIGHT);
    }
  });

  test('hovering as="a" passes color contrast', async ({ page }) => {
    await anchorButton(page).hover();
    // The a11y fixture's automatic axe scan (ADR-0002) runs after this test body,
    // while this anchor is still hovered, and catches any hover-state contrast violation.
  });

  test.describe("toggle", () => {
    const toggle = (page: Page, name: string) => button(page, "toggle", name);

    test("starts unpressed, and each click, Enter or Space flips aria-pressed", async ({
      page,
    }) => {
      const target = toggle(page, "Filled");
      await expect(target).toHaveAttribute("aria-pressed", "false");
      await target.click();
      await expect(target).toHaveAttribute("aria-pressed", "true");
      await target.press("Enter");
      await expect(target).toHaveAttribute("aria-pressed", "false");
      await target.press(" ");
      await expect(target).toHaveAttribute("aria-pressed", "true");
    });

    test("isSelected starts it pressed", async ({ page }) => {
      for (const name of TOGGLE_VARIANTS) {
        await expect(button(page, "toggle-selected", name)).toHaveAttribute(
          "aria-pressed",
          "true"
        );
      }
    });

    test("a Button that isn't a toggle has no aria-pressed", async ({
      page,
    }) => {
      await expect(button(page, "default", "Filled")).not.toHaveAttribute(
        "aria-pressed"
      );
    });

    test("each style uses M3's unselected and selected colors", async ({
      page,
    }) => {
      const colors = {
        Elevated: [
          ["surface-container-low", "primary"],
          ["primary", "on-primary"],
        ],
        Filled: [
          ["surface-container", "on-surface-variant"],
          ["primary", "on-primary"],
        ],
        Tonal: [
          ["secondary-container", "on-secondary-container"],
          ["secondary", "on-secondary"],
        ],
        Outlined: [
          [undefined, "on-surface-variant"],
          ["inverse-surface", "inverse-on-surface"],
        ],
      } as const;
      for (const name of TOGGLE_VARIANTS) {
        const [unselected, selected] = colors[name];
        const off = toggle(page, name);
        const on = button(page, "toggle-selected", name);
        await expect(off).toHaveCSS(
          "background-color",
          unselected[0] ? await role(page, unselected[0]) : "rgba(0, 0, 0, 0)"
        );
        await expect(off).toHaveCSS("color", await role(page, unselected[1]));
        await expect(on).toHaveCSS(
          "background-color",
          await role(page, selected[0])
        );
        await expect(on).toHaveCSS("color", await role(page, selected[1]));
      }
      await expect(toggle(page, "Outlined")).toHaveCSS(
        "border-top-color",
        await role(page, "outline-variant")
      );
    });

    test("selecting swaps its shape: round becomes square, square becomes round", async ({
      page,
    }) => {
      const round = toggle(page, "Filled");
      const square = toggle(page, "Square");
      expect(await px(round, "border-top-left-radius")).toBe(20);
      expect(await px(square, "border-top-left-radius")).toBe(12);

      await round.click();
      await square.click();
      await page.mouse.move(0, 0);
      await expect.poll(() => px(round, "border-top-left-radius")).toBe(12);
      await expect.poll(() => px(square, "border-top-left-radius")).toBe(20);
    });

    test("shows its selectedIcon while selected", async ({ page }) => {
      const target = toggle(page, "Favorite");
      const icons = target.locator("svg");
      await expect(icons.nth(0)).toBeVisible();
      await expect(icons.nth(1)).toBeHidden();
      await target.click();
      await expect(icons.nth(0)).toBeHidden();
      await expect(icons.nth(1)).toBeVisible();
    });

    test("a disabled, selected toggle looks disabled, and doesn't flip", async ({
      page,
    }) => {
      for (const name of TOGGLE_VARIANTS) {
        const target = button(page, "toggle-disabled", name);
        expect(alpha(await css(target, "color"))).toBeCloseTo(0.38, 2);
        expect(alpha(await css(target, "background-color"))).toBeCloseTo(
          0.1,
          2
        );
        await target.click({ force: true });
        await expect(target).toHaveAttribute("aria-pressed", "true");
      }
    });
  });
});
