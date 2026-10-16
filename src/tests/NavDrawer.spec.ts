import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";

// A NavDrawer can't be previewed live without taking over the site's own, so this checks the one
// in BaseLayout, on a component page. It holds a section for each NavRail destination: "/" (no
// label), one per component category under "/components" (all current here), and "/tests". Each
// window size class is its own describe, with a viewport inside it (M3: compact < 600px,
// medium < 840px, expanded < 1200px, large >= 1200px).
const drawer = (page: Page) => page.locator("[data-ac-nav-drawer]");
const drawerNav = (page: Page) =>
  page.getByRole("navigation", { name: "Section", exact: true });
const railItem = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Main", exact: true })
    .getByRole("link", { name, exact: true });
const section = (page: Page, path: string) =>
  page.locator(`[data-ac-nav-section="${path}"]`);
// Only the shown sections' links are in the accessibility tree
const sectionLinks = (page: Page) => drawerNav(page).getByRole("link");
const isMainInert = (page: Page) =>
  page.locator("main").evaluate((el) => el.closest("[inert]") !== null);

test.describe("NavDrawer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/button");
  });

  test.describe("large", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("is always visible beside the rail, showing the current page's sections", async ({
      page,
    }) => {
      await expect(drawer(page)).toBeVisible();
      await expect(section(page, "/components").first()).toBeVisible();
      await expect(section(page, "/")).toBeHidden();
      await expect(section(page, "/tests")).toBeHidden();
      await expect(
        drawerNav(page).getByRole("link", { name: "Button", exact: true })
      ).toHaveAttribute("aria-current", "page");
      // a standard drawer, so the rail items don't disclose it
      await expect(railItem(page, "Components")).not.toHaveAttribute(
        "aria-expanded"
      );
    });

    test("drops the divider above its first shown section only", async ({
      page,
    }) => {
      const shown = section(page, "/components");

      await expect(shown.nth(0).locator("hr")).toBeHidden();
      await expect(shown.nth(1).locator("hr")).toBeVisible();
    });

    test("hovering another rail item previews its section until the pointer leaves", async ({
      page,
    }) => {
      await railItem(page, "Tests").hover();
      await expect(section(page, "/tests")).toBeVisible();
      await expect(section(page, "/components").first()).toBeHidden();

      await page.mouse.move(900, 400);
      await expect(section(page, "/components").first()).toBeVisible();
      await expect(section(page, "/tests")).toBeHidden();
    });

    test("Tab goes from a rail item into its section and out to the next rail item", async ({
      page,
    }) => {
      await railItem(page, "Components").focus();
      await page.keyboard.press("Tab");
      await expect(sectionLinks(page).first()).toBeFocused();

      await page.keyboard.press("ArrowLeft");
      await expect(railItem(page, "Components")).toBeFocused();

      await page.keyboard.press("Tab");
      await sectionLinks(page).last().focus();
      await page.keyboard.press("Tab");
      await expect(railItem(page, "Tests")).toBeFocused();
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 700, height: 800 } });

    test("is a closed overlay that each rail item discloses", async ({
      page,
    }) => {
      const id = await drawer(page).getAttribute("id");

      await expect(drawer(page)).toBeHidden();
      for (const name of ["Start here", "Components", "Tests"]) {
        await expect(railItem(page, name)).toHaveAttribute(
          "aria-expanded",
          "false"
        );
        await expect(railItem(page, name)).toHaveAttribute(
          "aria-controls",
          id!
        );
      }
    });

    test("ArrowRight opens it as a modal, and Escape closes it, returning focus", async ({
      page,
    }) => {
      await railItem(page, "Components").focus();
      await page.keyboard.press("ArrowRight");

      await expect(drawer(page)).toBeVisible();
      await expect(sectionLinks(page).first()).toBeFocused();
      await expect(railItem(page, "Components")).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(await isMainInert(page)).toBe(true);

      await page.keyboard.press("Escape");
      await expect(drawer(page)).toBeHidden();
      await expect(railItem(page, "Components")).toBeFocused();
      await expect(railItem(page, "Components")).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      expect(await isMainInert(page)).toBe(false);
    });

    test("opens on hover with the hovered item's section, and a click on the scrim closes it", async ({
      page,
    }) => {
      await railItem(page, "Tests").hover();
      await expect(drawer(page)).toBeVisible();
      await expect(section(page, "/tests")).toBeVisible();

      // past the rail and the 220px drawer
      await page.mouse.click(600, 400);
      await expect(drawer(page)).toBeHidden();
      expect(await isMainInert(page)).toBe(false);
    });
  });

  test.describe("compact", () => {
    test.use({ viewport: { width: 400, height: 800 } });

    test("moves its sections into the rail, which opens expanded instead", async ({
      page,
    }) => {
      await expect(drawer(page).locator("[data-ac-nav-section]")).toHaveCount(
        0
      );
      await expect(
        page.locator("[data-ac-nav-rail] nav [data-ac-nav-section]").first()
      ).toBeAttached();
    });
  });
});
