import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

async function resolvedColor(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.color = value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssValue);
}

// Every live Fab on /components/fab sits inside a CodePreview (data-testid="code-preview"); the
// source block beside each preview is highlighted text, not real controls. A Fab's accessible
// name is its `label`, visible or not.
const fabs = (page: Page, name: string) =>
  page.getByTestId("code-preview").getByRole("button", { name, exact: true });

const size = async (target: Locator) => {
  const { width, height } = (await target.boundingBox())!;
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
    await expect(usage).toHaveCSS("border-top-left-radius", "16px");
    await expect(usage).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-primary-container)")
    );
    await expect(usage).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-primary-container)")
    );
    await expect(usage.getByText("Compose")).toHaveClass(/\bsr-only\b/);
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
    const sizes = [
      { side: 56, radius: "16px" },
      { side: 80, radius: "20px" },
      { side: 96, radius: "28px" },
    ];
    const create = fabs(page, "Create");

    for (const [i, { side, radius }] of sizes.entries()) {
      const fab = create.nth(6 + i);
      expect(await size(fab)).toEqual({ width: side, height: side });
      await expect(fab).toHaveCSS("border-top-left-radius", radius);
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
