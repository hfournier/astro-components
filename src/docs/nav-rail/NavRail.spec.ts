import type { Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

// A NavRail can't be previewed live without taking over the site's own, so this checks the one
// in BaseLayout, on a component page: a rail that isn't expandable (its sub-items are in a
// NavDrawer), with a Search FAB and three destinations, "Components" being current. Each window
// size class is its own describe, with a viewport inside it (M3: compact < 600px, medium < 840px,
// large >= 1200px).
const rail = (page: Page) => page.locator("[data-ac-nav-rail]");
const railNav = (page: Page) =>
  page.getByRole("navigation", { name: "Main", exact: true });
const destination = (page: Page, name: string) =>
  railNav(page).getByRole("link", { name, exact: true });
const menuToggle = (page: Page) =>
  rail(page).getByRole("button", { name: "Menu", exact: true });
// The modal rail makes the rest of the page inert
const isMainInert = (page: Page) =>
  page.locator("main").evaluate((el) => el.closest("[inert]") !== null);

test.describe("NavRail", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/button");
  });

  test.describe("large", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("is M3's 96px collapsed rail, its current destination marked", async ({
      page,
    }) => {
      expect((await rail(page).boundingBox())!.width).toBe(96);
      for (const name of ["Start here", "Components", "Tests"]) {
        await expect(destination(page, name)).toBeVisible();
      }
      await expect(destination(page, "Components")).toHaveAttribute(
        "aria-current",
        "page"
      );
      await expect(destination(page, "Start here")).not.toHaveAttribute(
        "aria-current"
      );
      await expect(destination(page, "Tests")).not.toHaveAttribute(
        "aria-current"
      );
    });

    test("hides its menu toggle, and shows its FAB unextended", async ({
      page,
    }) => {
      const fab = rail(page).getByRole("button", { name: "Search" });
      const { width, height } = (await fab.boundingBox())!;

      await expect(menuToggle(page)).toBeHidden();
      expect({ width, height }).toEqual({ width: 56, height: 56 });
      await expect(fab.getByText("Search")).toHaveClass(/\bsr-only\b/);
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 700, height: 800 } });

    test("stays in the layout, collapsed, with no menu toggle", async ({
      page,
    }) => {
      expect((await rail(page).boundingBox())!.width).toBe(96);
      await expect(destination(page, "Components")).toBeVisible();
      await expect(menuToggle(page)).toBeHidden();
    });
  });

  test.describe("compact", () => {
    test.use({ viewport: { width: 400, height: 800 } });

    test("is hidden behind its menu toggle until opened", async ({ page }) => {
      await expect(menuToggle(page)).toBeVisible();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
      await expect(destination(page, "Components")).toBeHidden();
      expect(await isMainInert(page)).toBe(false);
    });

    test("opens as a modal expanded rail, with its drawer's sections after its destinations", async ({
      page,
    }) => {
      await menuToggle(page).click();

      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
      await expect(destination(page, "Components")).toBeVisible();
      await expect(destination(page, "Components")).toBeInViewport();
      // the current page's section, moved here from the NavDrawer
      await expect(destination(page, "Button")).toHaveAttribute(
        "aria-current",
        "page"
      );
      expect(await isMainInert(page)).toBe(true);
    });

    test("Escape from inside it closes it and returns focus to the menu toggle", async ({
      page,
    }) => {
      // from the keyboard: WebKit doesn't focus a button on click
      await menuToggle(page).focus();
      await page.keyboard.press("Enter");
      await expect(destination(page, "Components")).toBeVisible();
      await destination(page, "Components").focus();

      await page.keyboard.press("Escape");
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
      await expect(destination(page, "Components")).toBeHidden();
      await expect(menuToggle(page)).toBeFocused();
      expect(await isMainInert(page)).toBe(false);
    });

    test("a click on the scrim closes it", async ({ page }) => {
      await menuToggle(page).click();
      await expect(destination(page, "Components")).toBeVisible();

      // past the 220px rail
      await page.mouse.click(380, 400);
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
      await expect(destination(page, "Components")).toBeHidden();
      expect(await isMainInert(page)).toBe(false);
    });
  });
});
