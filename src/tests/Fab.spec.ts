import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/fab is a Section with data-testid="fab-<caseId>". A Fab's accessible name
// is its `label`, visible or not, and each label names the color or size it shows.
type FabCaseId = "no-props" | "colors" | "sizes" | "extended";

const fab = (page: Page, caseId: FabCaseId, name: string) =>
  page.getByTestId(`fab-${caseId}`).getByRole("button", { name, exact: true });

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
    const usage = fab(page, "no-props", "Compose");

    await expect(usage).toHaveAttribute("type", "button");
    expect(await size(usage)).toEqual({ width: 56, height: 56 });
    await expect(usage).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-primary-container)")
    );
    await expect(usage).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-primary-container)")
    );
    // visually hidden: clipped to at most a pixel
    expect((await box(usage.getByText("Compose"))).width).toBeLessThanOrEqual(
      1
    );
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

  test("an extended FAB shows its label and grows to fit it, keeping its size's height", async ({
    page,
  }) => {
    const heights = { Compose: 56, "Compose md": 80, "Compose lg": 96 };

    for (const [name, height] of Object.entries(heights)) {
      const extended = fab(page, "extended", name);
      await expect(extended.getByText(name)).toBeVisible();
      const { width, height: actual } = await size(extended);
      expect(actual).toBe(height);
      expect(width).toBeGreaterThan(height);
    }

    // M3's default extended FAB: 16px from each edge to its icon and label
    const extended = fab(page, "extended", "Compose");
    const fabBox = await box(extended);
    const icon = await box(extended.locator("svg"));
    const label = await box(extended.getByText("Compose"));
    expect(icon.x - fabBox.x).toBe(16);
    expect(fabBox.x + fabBox.width - (label.x + label.width)).toBeCloseTo(
      16,
      0
    );
  });

  test("sits at elevation 3, rising to 4 on hover", async ({ page }) => {
    const usage = fab(page, "no-props", "Compose");
    const shadow = () => usage.evaluate((el) => getComputedStyle(el).boxShadow);
    const atRest = await shadow();

    expect(atRest).not.toBe("none");
    await usage.hover();
    await expect.poll(shadow).not.toBe(atRest);
  });
});
