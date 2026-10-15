import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../tests/support/a11y-fixture";
import { box, resolvedColor } from "../../tests/support/helpers";

// Every live Fab on /components/fab sits inside a CodePreview (data-testid="code-preview"); the
// source block beside each preview is highlighted text, not real controls. A Fab's accessible
// name is its `label`, visible or not.
const fabs = (page: Page, name: string) =>
  page.getByTestId("code-preview").getByRole("button", { name, exact: true });

const size = async (target: Locator) => {
  const { width, height } = await box(target);
  return { width, height };
};

test.describe("Fab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/fab");
  });

  test("defaults to a 56px primary-container FAB, its label only an accessible name", async ({
    page,
  }) => {
    // the usage example, followed by example-03's extended FABs with the same label
    const usage = fabs(page, "Compose").first();

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
    // example-01 order
    const roles = [
      "primary-container",
      "secondary-container",
      "tertiary-container",
      "primary",
      "secondary",
      "tertiary",
    ];
    const create = fabs(page, "Create");

    for (const [i, role] of roles.entries()) {
      await expect(create.nth(i)).toHaveCSS(
        "background-color",
        await resolvedColor(page, `var(--theme-color-${role})`)
      );
      await expect(create.nth(i)).toHaveCSS(
        "color",
        await resolvedColor(page, `var(--theme-color-on-${role})`)
      );
    }
  });

  test("each size is M3's FAB, medium FAB or large FAB", async ({ page }) => {
    // example-02 follows example-01's six
    const create = fabs(page, "Create");

    for (const [i, side] of [56, 80, 96].entries()) {
      expect(await size(create.nth(6 + i))).toEqual({
        width: side,
        height: side,
      });
    }
  });

  test("an extended FAB shows its label and grows to fit it, keeping its size's height", async ({
    page,
  }) => {
    const extended = fabs(page, "Compose");

    for (const [i, height] of [56, 80, 96].entries()) {
      const fab = extended.nth(1 + i);
      await expect(fab.getByText("Compose")).toBeVisible();
      const { width, height: actual } = await size(fab);
      expect(actual).toBe(height);
      expect(width).toBeGreaterThan(height);
    }

    // M3's default extended FAB: 16px from each edge to its icon and label
    const fab = extended.nth(1);
    const fabBox = await box(fab);
    const icon = await box(fab.locator("svg"));
    const label = await box(fab.getByText("Compose"));
    expect(icon.x - fabBox.x).toBe(16);
    expect(fabBox.x + fabBox.width - (label.x + label.width)).toBeCloseTo(
      16,
      0
    );
  });

  test("sits at elevation 3, rising to 4 on hover", async ({ page }) => {
    const usage = fabs(page, "Compose").first();
    const shadow = () => usage.evaluate((el) => getComputedStyle(el).boxShadow);
    const atRest = await shadow();

    expect(atRest).not.toBe("none");
    await usage.hover();
    await expect.poll(shadow).not.toBe(atRest);
  });
});
