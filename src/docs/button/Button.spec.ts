import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";
import { box, expectFocusRing, resolvedColor } from "../../test/helpers";

const VARIANTS = ["Elevated", "Filled", "Tonal", "Outlined", "Text"] as const;

const SIZES = [
  { name: "Small button", height: 40 },
  { name: "Medium button", height: 48 },
  { name: "Large button", height: 56 },
] as const;

// Every live button on /components/button sits inside a CodePreview
// (data-testid="code-preview"); the source block beside each preview is highlighted <pre>
// text, not real controls, so locators are scoped through it. example-01 renders each variant
// twice - enabled, then disabled - so the two rows are told apart by `disabled`.
const button = (page: Page, name: string, disabled = false) =>
  page
    .getByTestId("code-preview")
    .getByRole("button", { name, exact: true, disabled });

// example-05 renders Button as="a": a real anchor, so its role is "link"
const anchorButton = (page: Page) =>
  page
    .getByTestId("code-preview")
    .getByRole("link", { name: "Anchor button", exact: true });

// The alpha of a computed color: M3's disabled colors are on-surface at 38% / 10%, which
// Tailwind's `/38` and `/10` modifiers mix in oklab, so the channels are compared by alpha only.
const alpha = (color: string): number => {
  const match =
    color.match(/\/\s*([\d.]+)\)$/) ?? color.match(/rgba\(.*,\s*([\d.]+)\)$/);
  return match ? parseFloat(match[1]!) : 1;
};

const stateLayerOpacity = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el, "::before").opacity);

test.describe("Button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/button");
  });

  test("defaults to the filled variant, round shape and medium size", async ({
    page,
  }) => {
    const usage = button(page, "Primary Button");
    const filled = button(page, "Filled");

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

    const filled = button(page, "Filled");
    await expect(filled).toHaveCSS("background-color", await role("primary"));
    await expect(filled).toHaveCSS("color", await role("on-primary"));

    const tonal = button(page, "Tonal");
    await expect(tonal).toHaveCSS(
      "background-color",
      await role("secondary-container")
    );
    await expect(tonal).toHaveCSS(
      "color",
      await role("on-secondary-container")
    );

    const elevated = button(page, "Elevated");
    await expect(elevated).toHaveCSS(
      "background-color",
      await role("surface-container-low")
    );
    await expect(elevated).toHaveCSS("color", await role("primary"));
    expect(
      await elevated.evaluate((el) => getComputedStyle(el).boxShadow)
    ).toMatch(/0px 1px 2px 0px/);

    const outlined = button(page, "Outlined");
    await expect(outlined).toHaveCSS("background-color", transparent);
    await expect(outlined).toHaveCSS(
      "border-top-color",
      await role("outline-variant")
    );
    await expect(outlined).toHaveCSS("color", await role("on-surface-variant"));

    const text = button(page, "Text");
    await expect(text).toHaveCSS("background-color", transparent);
    await expect(text).toHaveCSS("border-top-color", transparent);
    await expect(text).toHaveCSS("color", await role("primary"));
  });

  test("disabled buttons use M3's on-surface 38% label and 10% container", async ({
    page,
  }) => {
    for (const name of VARIANTS) {
      const target = button(page, name, true);
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
        expect(alpha(style.border)).toBeCloseTo(0.1, 2);
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
      const target = button(page, name);
      await target.hover();
      await expect.poll(() => stateLayerOpacity(target)).toBe("0.08");
    }

    const disabled = button(page, "Filled", true);
    await disabled.hover({ force: true });
    await expect.poll(() => stateLayerOpacity(disabled)).toBe("0");
  });

  test("the elevated button's shadow rises on hover", async ({ page }) => {
    const elevated = button(page, "Elevated");
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
      await button(page, name).hover();
      // The a11y fixture's automatic axe scan (ADR-0002) runs after this test body,
      // while this button is still hovered, and catches any hover-state contrast violation.
    });
  }

  test("focus shows the state layer and the focus ring", async ({ page }) => {
    for (const name of VARIANTS) {
      const target = button(page, name);
      await target.focus();
      await expectFocusRing(target);
      // the state layer transitions in, so poll
      await expect.poll(() => stateLayerOpacity(target)).toBe("0.1");
    }
  });

  test("shape: round is fully rounded, square uses the size's corner radius", async ({
    page,
  }) => {
    const round = button(page, "Round button");
    const radius = await round.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopLeftRadius)
    );
    const { height } = await box(round);
    expect(radius).toBeGreaterThanOrEqual(height / 2);

    await expect(button(page, "Square button")).toHaveCSS(
      "border-top-left-radius",
      "14px"
    );
  });

  test("each size is M3's button height", async ({ page }) => {
    for (const { name, height } of SIZES) {
      expect((await box(button(page, name))).height).toBe(height);
    }
  });

  test("the small size keeps a 48px touch target", async ({ page }) => {
    const small = button(page, "Small button");
    const targetHeight = await small.evaluate((el) =>
      parseFloat(getComputedStyle(el, "::after").height)
    );
    expect(targetHeight).toBeGreaterThanOrEqual(48);
  });

  test("showFullwidth stretches to the width of its container", async ({
    page,
  }) => {
    const target = button(page, "Full width button");
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

    const filled = button(page, "Filled");
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

  // example-06/07 put the label on its own line, which MDX would otherwise wrap in a <p>
  test("a label on its own line in MDX renders without a paragraph", async ({
    page,
  }) => {
    const multiLine = [
      page
        .getByTestId("code-preview")
        .getByRole("link", { name: "Multi-line anchor button", exact: true }),
      button(page, "Multi-line button"),
    ];
    for (const target of multiLine) {
      await expect(target.locator("p")).toHaveCount(0);
      expect((await box(target)).height).toBe(48);
    }
  });

  test('hovering as="a" passes color contrast', async ({ page }) => {
    await anchorButton(page).hover();
    // The a11y fixture's automatic axe scan (ADR-0002) runs after this test body,
    // while this anchor is still hovered, and catches any hover-state contrast violation.
  });
});
