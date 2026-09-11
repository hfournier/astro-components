import type { Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

const COMBINATIONS = [
  "Solid Primary",
  "Solid Secondary",
  "Outline Primary",
  "Outline Secondary",
];

// The demo now lives on the shared doc page at /components/button: the Usage block
// plus example-01 (solid) and example-02 (outline). Every live button sits inside a
// CodePreview (data-testid="code-preview"); the source block beside each preview is
// highlighted <pre> text, not real controls, so locators are scoped through it.
const button = (page: Page, name: string) =>
  page.getByTestId("code-preview").getByRole("button", { name, exact: true });

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

test.describe("Button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/button");
  });

  test("renders every variant/color combination via the color prop", async ({
    page,
  }) => {
    for (const name of COMBINATIONS) {
      await expect(button(page, name)).toBeVisible();
    }
  });

  test("solid variant resolves the color-role background", async ({ page }) => {
    const primary = await resolvedColor(page, "var(--color-primary-control)");
    const secondary = await resolvedColor(
      page,
      "var(--color-secondary-control)"
    );

    await expect(button(page, "Solid Primary")).toHaveCSS(
      "background-color",
      primary
    );
    await expect(button(page, "Solid Secondary")).toHaveCSS(
      "background-color",
      secondary
    );
  });

  test("outline variant resolves the color-role border and text", async ({
    page,
  }) => {
    const primary = await resolvedColor(page, "var(--color-primary-control)");
    const secondary = await resolvedColor(
      page,
      "var(--color-secondary-control)"
    );

    const outlinePrimary = button(page, "Outline Primary");
    await expect(outlinePrimary).toHaveCSS("border-color", primary);
    await expect(outlinePrimary).toHaveCSS("color", primary);

    const outlineSecondary = button(page, "Outline Secondary");
    await expect(outlineSecondary).toHaveCSS("border-color", secondary);
    await expect(outlineSecondary).toHaveCSS("color", secondary);
  });

  for (const name of COMBINATIONS) {
    test(`hovering "${name}" passes color contrast`, async ({ page }) => {
      await button(page, name).hover();
      // The a11y fixture's automatic axe scan (ADR-0002) runs after this test body,
      // while this button is still hovered, and catches any hover-state contrast violation.
    });
  }

  test("focus ring resolves to the dedicated tokens regardless of color", async ({
    page,
  }) => {
    const expectedColor = await resolvedColor(page, "var(--color-focus-ring)");
    const [expectedWidth, expectedOffset] = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return [
        root.getPropertyValue("--focus-ring-width").trim(),
        root.getPropertyValue("--focus-ring-offset").trim(),
      ];
    });

    for (const name of COMBINATIONS) {
      const target = button(page, name);
      await target.focus();
      await expect(target).toHaveCSS("outline-color", expectedColor);
      await expect(target).toHaveCSS("outline-width", expectedWidth);
      await expect(target).toHaveCSS("outline-offset", expectedOffset);
    }
  });
});
