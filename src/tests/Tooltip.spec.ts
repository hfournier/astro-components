import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box } from "./support/helpers";

// Each case on /tests/tooltip is a Section with data-testid="tooltip-<caseId>": plain holds a plain
// tooltip inside an icon-only link, rich a rich tooltip with a subhead and an action, after the
// ButtonIcon it describes.
type TooltipCaseId = "plain" | "rich";

const tooltipCase = (page: Page, caseId: TooltipCaseId) =>
  page.getByTestId(`tooltip-${caseId}`);

const plainParent = (page: Page) =>
  tooltipCase(page, "plain").getByRole("link", { name: "GitHub repository" });
const plainTooltip = (page: Page) =>
  plainParent(page).locator("[data-ac-tooltip]");

const richTrigger = (page: Page) =>
  tooltipCase(page, "rich").getByRole("button", { name: "About autosave" });
const richTooltip = (page: Page) =>
  tooltipCase(page, "rich").locator("[data-ac-tooltip-rich]");

const isOpen = (tooltip: Locator) =>
  tooltip.evaluate((el) => el.matches(":popover-open"));

test.describe("Tooltip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/tooltip");
  });

  test.describe("plain", () => {
    test("is M3's 24px high plain tooltip", async ({ page }) => {
      await plainParent(page).focus();
      await expect(plainTooltip(page)).toBeVisible();

      expect((await box(plainTooltip(page))).height).toBe(24);
    });

    test("repeats its element's name, hidden from assistive tech, and is hidden at rest", async ({
      page,
    }) => {
      await expect(plainTooltip(page)).toHaveText("GitHub repository");
      await expect(plainTooltip(page)).toHaveAttribute("aria-hidden", "true");
      await expect(plainTooltip(page)).toBeHidden();
    });

    test("shows on hover after M3's delay", async ({ page }) => {
      await plainParent(page).hover();

      await expect(plainTooltip(page)).toHaveCSS("transition-delay", /0\.5s/);
      await expect(plainTooltip(page)).toBeVisible();
    });

    test("shows straight away on keyboard focus, and Escape hides it in place", async ({
      page,
    }) => {
      await plainParent(page).focus();
      await expect(plainTooltip(page)).toHaveCSS("transition-delay", /^0s/);
      await expect(plainTooltip(page)).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(plainTooltip(page)).toBeHidden();
      await expect(plainParent(page)).toBeFocused();
    });

    test("with reduced motion, keeps the hover delay but doesn't fade", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const property = await plainTooltip(page).evaluate(
        (el) => getComputedStyle(el).transitionProperty
      );

      expect(property).toContain("visibility");
      expect(property).not.toContain("opacity");
      await plainParent(page).hover();
      await expect(plainTooltip(page)).toBeVisible();
    });
  });

  test.describe("rich", () => {
    test("describes its trigger with its subhead and text, not its actions", async ({
      page,
    }) => {
      const describedBy =
        await richTrigger(page).getAttribute("aria-describedby");
      const description = page.locator(`[id="${describedBy}"]`);

      await expect(description).toContainText("Autosave is on");
      await expect(description).toContainText("Changes are saved as you type");
      await expect(description).not.toContainText("Learn more");
      await expect(richTooltip(page)).toBeHidden();
    });

    test("opens on hover, and closes once the pointer has left", async ({
      page,
    }) => {
      await richTrigger(page).hover();
      await expect(richTooltip(page)).toBeVisible();

      await page.mouse.move(0, 0);
      await expect.poll(() => isOpen(richTooltip(page))).toBe(false);
    });

    test("opens on keyboard focus, lets Tab reach its action, and Escape returns focus", async ({
      page,
    }) => {
      await richTrigger(page).focus();
      await expect(richTooltip(page)).toBeVisible();

      await page.keyboard.press("Tab");
      await expect(
        richTooltip(page).getByRole("button", { name: "Learn more" })
      ).toBeFocused();
      expect(await isOpen(richTooltip(page))).toBe(true);

      await page.keyboard.press("Escape");
      await expect.poll(() => isOpen(richTooltip(page))).toBe(false);
      await expect(richTrigger(page)).toBeFocused();
    });
  });
});
