import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { SvgIconNameTypes } from "../svgs";
import { test, expect } from "./support/a11y-fixture";
import { box, castsNoShadow, resolvedColor, settled } from "./support/helpers";

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

    test("with its own bgColor, keeps it as a standard drawer", async ({
      page,
    }) => {
      // the site's drawer is on surface-container-low, like its rail
      await expect(drawer(page)).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
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

// /tests/nav-drawer has its own layout with a rail ("Test rail") and a drawer ("Test section") on
// their default backgrounds. The rail's destinations are Home (this page, current) and Components.
// Home's section holds Overview (this page, current, with home-fill as its active icon), Inbox (a
// count of 3) and a label too long for the drawer (a count of 1500); Components' holds Button and
// Badge.
const testRailItem = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Test rail", exact: true })
    .getByRole("link", { name, exact: true });
const testLinks = (page: Page) =>
  page
    .getByRole("navigation", { name: "Test section", exact: true })
    .getByRole("link");
const testLink = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Test section", exact: true })
    .getByRole("link", { name, exact: true });
const longLabel = "Notifications, privacy and security settings";
const iconPath = (name: SvgIconNameTypes) =>
  readFileSync(
    new URL(`../assets/svgs/${name}.svg`, import.meta.url),
    "utf8"
  ).match(/ d="([^"]+)"/)![1];

test.describe("NavDrawer on its default background", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/nav-drawer");
  });

  test.describe("large", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("is M3's standard drawer, on surface with no shadow", async ({
      page,
    }) => {
      await expect(drawer(page)).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface)")
      );
      expect(await castsNoShadow(drawer(page))).toBe(true);
      // the border, in outline-variant, is what separates it from a rail on surface
      await expect(drawer(page)).toHaveCSS(
        "border-left-color",
        await resolvedColor(page, "var(--theme-color-outline-variant)")
      );
    });

    test("ArrowDown and ArrowUp move between the shown section's links, stopping at the ends", async ({
      page,
    }) => {
      const links = testLinks(page);
      await links.nth(0).focus();
      await page.keyboard.press("ArrowUp");
      await expect(links.nth(0)).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(links.nth(1)).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(links.nth(2)).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(links.nth(2)).toBeFocused();
      await page.keyboard.press("ArrowUp");
      await expect(links.nth(1)).toBeFocused();
    });

    test("shows the current item's activeIcon, and the others' icon", async ({
      page,
    }) => {
      await expect(
        testLink(page, "Overview").locator("svg path")
      ).toHaveAttribute("d", iconPath("home-fill"));
      await expect(
        testLink(page, `${longLabel}, 1500`).locator("svg path")
      ).toHaveAttribute("d", iconPath("settings"));
    });

    test("shows a badge label at the item's end, in its accessible name", async ({
      page,
    }) => {
      const inbox = testLink(page, "Inbox, 3");
      await expect(inbox).toBeVisible();
      const count = inbox.getByText("3", { exact: true });
      const itemBox = await box(inbox);
      const countBox = await box(count);
      // the item's 16px end padding
      expect(countBox.x + countBox.width).toBeCloseTo(
        itemBox.x + itemBox.width - 16,
        0
      );
      await expect(count).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface-variant)")
      );
      await expect(count).toHaveCSS("font-size", "14px");
    });

    test("truncates a long label before its count, which stays whole, capped at 999+", async ({
      page,
    }) => {
      const item = testLink(page, `${longLabel}, 1500`);
      const count = item.getByText("999+", { exact: true });
      await expect(count).toBeVisible();
      const label = item.getByText(longLabel, { exact: true });
      expect(
        await label.evaluate((el) => el.scrollWidth > el.clientWidth)
      ).toBe(true);
      const labelBox = await box(label);
      const countBox = await box(count);
      // 12px apart, both inside the item
      expect(countBox.x - (labelBox.x + labelBox.width)).toBeCloseTo(12, 0);
      const itemBox = await box(item);
      expect(countBox.x + countBox.width).toBeLessThanOrEqual(
        itemBox.x + itemBox.width
      );
    });

    test("pressing an inactive item shows an on-secondary-container state layer, keeping its label color", async ({
      page,
    }) => {
      const inbox = testLink(page, "Inbox, 3");
      const { x, y, width, height } = await box(inbox);
      await page.mouse.move(x + width / 2, y + height / 2);
      await page.mouse.down();
      expect(
        await inbox.evaluate(
          (el) => getComputedStyle(el, "::before").backgroundColor
        )
      ).toBe(
        await resolvedColor(page, "var(--theme-color-on-secondary-container)")
      );
      await expect(inbox).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface)")
      );
      // released off the item, so it doesn't navigate
      await page.mouse.move(900, 400);
      await page.mouse.up();
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 700, height: 800 } });

    test("open, is M3's modal drawer, on surface-container-low", async ({
      page,
    }) => {
      await testRailItem(page, "Home").focus();
      await page.keyboard.press("ArrowRight");
      await expect(drawer(page)).toBeVisible();
      await expect(drawer(page)).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
    });

    test.describe("right to left", () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.evaluate(() => (document.documentElement.dir = "rtl"));
      });

      test("closed, it's under the rail, not off the left edge", async ({
        page,
      }) => {
        const rail = await box(page.locator("[data-ac-nav-rail]"));
        const closed = await drawer(page).evaluate((el) => {
          const { left, right } = el.getBoundingClientRect();
          return { left, right };
        });
        expect(closed.left).toBeGreaterThanOrEqual(rail.x - 1);
      });

      test("the arrow key toward the drawer, ArrowLeft, opens it to the rail's left; ArrowRight goes back", async ({
        page,
      }) => {
        const home = testRailItem(page, "Home");
        await home.focus();
        await page.keyboard.press("ArrowLeft");
        await expect(drawer(page)).toBeVisible();
        await expect(testLinks(page).first()).toBeFocused();
        await settled(page);

        const rail = await box(page.locator("[data-ac-nav-rail]"));
        const open = await box(drawer(page));
        expect(open.x + open.width).toBeCloseTo(rail.x, 0);
        await expect(drawer(page)).toHaveCSS("border-top-left-radius", "16px");
        await expect(drawer(page)).toHaveCSS("border-top-right-radius", "0px");
        await expect(drawer(page)).toHaveCSS("border-right-width", "1px");

        await page.keyboard.press("ArrowRight");
        await expect(home).toBeFocused();
      });
    });
  });
});
