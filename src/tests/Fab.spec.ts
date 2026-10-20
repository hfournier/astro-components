import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/fab is a Section with data-testid="fab-<caseId>". A Fab's accessible name
// is its `label`, visible or not. Each label names the color or size it shows, except the
// defaults' "Compose". The rail cases hold a plain "Search" FAB and an extended "Compose" one in a
// stand-in for a collapsed or an expanded NavRail.
type FabCaseId =
  | "no-props"
  | "colors"
  | "sizes"
  | "extended"
  | "rail-collapsed"
  | "rail-expanded"
  | "no-tooltip";

const fab = (page: Page, caseId: FabCaseId, name: string) =>
  page.getByTestId(`fab-${caseId}`).getByRole("button", { name, exact: true });

// The label span: the tooltip repeats its text, but is hidden from assistive tech
const fabLabel = (target: Locator) =>
  target.locator(":scope > span:not([aria-hidden])");

const size = async (target: Locator) => {
  const { width, height } = await box(target);
  return { width, height };
};

test.describe("Fab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fab");
  });

  test("defaults to a 56px primary-container FAB, its label only an accessible name", async ({
    page,
  }) => {
    const noProps = fab(page, "no-props", "Compose");

    await expect(noProps).toHaveAttribute("type", "button");
    expect(await size(noProps)).toEqual({ width: 56, height: 56 });
    await expect(noProps).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-primary-container)")
    );
    await expect(noProps).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-primary-container)")
    );
    // visually hidden: clipped to at most a pixel
    expect((await box(fabLabel(noProps))).width).toBeLessThanOrEqual(1);
  });

  test("each color resolves its M3 color roles", async ({ page }) => {
    const roles = [
      "primary-container",
      "secondary-container",
      "tertiary-container",
      "primary",
      "secondary",
      "tertiary",
    ];

    for (const role of roles) {
      const create = fab(page, "colors", `Create ${role}`);
      await expect(create).toHaveCSS(
        "background-color",
        await resolvedColor(page, `var(--theme-color-${role})`)
      );
      await expect(create).toHaveCSS(
        "color",
        await resolvedColor(page, `var(--theme-color-on-${role})`)
      );
    }
  });

  test("each size is M3's FAB, medium FAB or large FAB", async ({ page }) => {
    const sides = { default: 56, md: 80, lg: 96 };

    for (const [name, side] of Object.entries(sides)) {
      expect(await size(fab(page, "sizes", `Create ${name}`))).toEqual({
        width: side,
        height: side,
      });
    }
  });

  test("each size's icon is M3's 24, 28 or 36px", async ({ page }) => {
    const icons = { default: 24, md: 28, lg: 36 };

    for (const [name, side] of Object.entries(icons)) {
      const icon = fab(page, "sizes", `Create ${name}`).locator("svg");
      expect(await size(icon)).toEqual({ width: side, height: side });
    }
  });

  test.describe("tooltip", () => {
    // Tooltip's own specs cover its delays; these run the clock past the hover delay
    const hoverDelay = 500;
    const tooltip = (target: Locator) => target.locator("[data-ac-tooltip]");

    test.beforeEach(async ({ page }) => {
      await page.clock.install();
      await page.goto("/tests/fab");
    });

    test("shows the label on hover, hidden from assistive tech, and the name isn't repeated", async ({
      page,
    }) => {
      const noProps = fab(page, "no-props", "Compose");

      await expect(tooltip(noProps)).toHaveText("Compose");
      await expect(tooltip(noProps)).toHaveAttribute("aria-hidden", "true");
      await expect(noProps).toHaveAccessibleName("Compose");
      await expect(tooltip(noProps)).toBeHidden();

      await noProps.hover();
      await page.clock.runFor(hoverDelay);
      await expect(tooltip(noProps)).toBeVisible();
    });

    test("shows straight away on keyboard focus", async ({ page }) => {
      const noProps = fab(page, "no-props", "Compose");

      await noProps.focus();
      await expect(tooltip(noProps)).toBeVisible();
    });

    test("an extended FAB, which shows its label, never shows one", async ({
      page,
    }) => {
      const extended = fab(page, "extended", "Compose");

      await extended.hover();
      await page.clock.runFor(hoverDelay);
      await expect(tooltip(extended)).toBeHidden();
      await extended.focus();
      await page.clock.runFor(hoverDelay);
      await expect(tooltip(extended)).toBeHidden();
    });

    test("in a NavRail, shows while the rail is collapsed, and not while it's expanded", async ({
      page,
    }) => {
      // collapsed: both FABs are plain, label hidden, so both show it
      for (const name of ["Search", "Compose"]) {
        const target = fab(page, "rail-collapsed", name);
        await target.focus();
        await expect(tooltip(target)).toBeVisible();
      }
      // expanded: both are extended, label shown, so neither does
      for (const name of ["Search", "Compose"]) {
        const target = fab(page, "rail-expanded", name);
        await target.focus();
        await page.clock.runFor(hoverDelay);
        await expect(tooltip(target)).toBeHidden();
      }
    });

    test("showTooltip={false} leaves it out", async ({ page }) => {
      await expect(tooltip(fab(page, "no-tooltip", "Compose"))).toHaveCount(0);
    });
  });

  test("an extended FAB shows its label and grows to fit it, keeping its size's height", async ({
    page,
  }) => {
    const heights = { Compose: 56, "Compose md": 80, "Compose lg": 96 };

    for (const [name, height] of Object.entries(heights)) {
      const extended = fab(page, "extended", name);
      await expect(fabLabel(extended)).toHaveText(name);
      await expect(fabLabel(extended)).toBeVisible();
      const { width, height: actual } = await size(extended);
      expect(actual).toBe(height);
      expect(width).toBeGreaterThan(height);
    }

    // M3's default extended FAB: 16px from each edge to its icon and label
    const defaultExtended = fab(page, "extended", "Compose");
    const fabBox = await box(defaultExtended);
    const icon = await box(defaultExtended.locator("svg"));
    const label = await box(fabLabel(defaultExtended));
    expect(icon.x - fabBox.x).toBe(16);
    expect(fabBox.x + fabBox.width - (label.x + label.width)).toBeCloseTo(
      16,
      0
    );

    // M3's large extended FAB: 28px from each edge, a 36px icon, 16px between icon and label
    const largeExtended = fab(page, "extended", "Compose lg");
    const largeBox = await box(largeExtended);
    const largeIcon = await box(largeExtended.locator("svg"));
    const largeLabel = await box(fabLabel(largeExtended));
    expect(largeIcon.x - largeBox.x).toBe(28);
    expect(largeIcon.width).toBe(36);
    expect(largeLabel.x - (largeIcon.x + largeIcon.width)).toBeCloseTo(16, 0);
    expect(
      largeBox.x + largeBox.width - (largeLabel.x + largeLabel.width)
    ).toBeCloseTo(28, 0);
  });

  test("sits at elevation 3, rising to 4 on hover", async ({ page }) => {
    const noProps = fab(page, "no-props", "Compose");
    const shadow = () =>
      noProps.evaluate((el) => getComputedStyle(el).boxShadow);
    const atRest = await shadow();

    expect(atRest).not.toBe("none");
    await noProps.hover();
    await expect.poll(shadow).not.toBe(atRest);
  });
});
