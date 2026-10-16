import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// The nav-bar-three-destinations case on /tests/nav-bar holds one `static` NavBar, with Home
// (current), Search and Settings. Its <nav> is inside the bar ([data-ac-nav-bar]), found by its
// label so the spec still checks the label reaches it.
const bar = (page: Page) =>
  page.getByTestId("nav-bar-three-destinations").locator("[data-ac-nav-bar]");
const nav = (page: Page) =>
  bar(page).getByRole("navigation", {
    name: "Three destinations",
    exact: true,
  });
const item = (page: Page, name: string) =>
  nav(page).getByRole("link", { name, exact: true });
// The current item's active indicator: the icon's 56x32 pill below medium, the content span
// holding icon and label from medium up
const iconIndicator = (page: Page, name: string) =>
  item(page, name).locator("svg").locator("..");
const content = (page: Page, name: string) =>
  item(page, name).locator("> span").first();
const label = (page: Page, name: string) =>
  item(page, name).getByText(name, { exact: true });

test.describe("NavBar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/nav-bar");
  });

  test.describe("compact", () => {
    test.use({ viewport: { width: 400, height: 800 } });

    test("is M3's 64px bar on surface-container", async ({ page }) => {
      expect((await box(bar(page))).height).toBe(64);
      await expect(bar(page)).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container)")
      );
    });

    test("shares its width equally between vertical items", async ({
      page,
    }) => {
      const widths = await Promise.all(
        ["Home", "Search", "Settings"].map(
          async (name) => (await box(item(page, name))).width
        )
      );
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);

      const icon = await box(iconIndicator(page, "Search"));
      const text = await box(label(page, "Search"));
      expect(text.y).toBeCloseTo(icon.y + icon.height + 4, 0);
    });

    test("marks the current item with a 56x32 indicator", async ({ page }) => {
      await expect(item(page, "Home")).toHaveAttribute("aria-current", "page");
      await expect(item(page, "Search")).not.toHaveAttribute("aria-current");

      const indicator = iconIndicator(page, "Home");
      const { width, height } = await box(indicator);
      // Firefox lays the equal-width items out on subpixels
      expect(width).toBeCloseTo(56, 2);
      expect(height).toBeCloseTo(32, 2);
      await expect(indicator).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-secondary-container)")
      );
      await expect(label(page, "Home")).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-secondary)")
      );
      await expect(label(page, "Search")).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface-variant)")
      );
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 700, height: 800 } });

    test("groups horizontal items in the middle of the bar", async ({
      page,
    }) => {
      const barBox = await box(bar(page));
      const first = await box(item(page, "Home"));
      const last = await box(item(page, "Settings"));
      const groupCenter = (first.x + last.x + last.width) / 2;
      expect(groupCenter).toBeCloseTo(barBox.x + barBox.width / 2, 0);

      const icon = await box(item(page, "Search").locator("svg"));
      const text = await box(label(page, "Search"));
      expect(text.x).toBeGreaterThan(icon.x + icon.width);
      expect(text.y + text.height / 2).toBeCloseTo(icon.y + icon.height / 2, 0);
    });

    test("puts the current item's icon and label in a 40px indicator", async ({
      page,
    }) => {
      const indicator = content(page, "Home");
      expect((await box(indicator)).height).toBe(40);
      await expect(indicator).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-secondary-container)")
      );
      await expect(label(page, "Home")).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-secondary-container)")
      );
    });
  });
});
