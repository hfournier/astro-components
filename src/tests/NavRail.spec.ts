import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import type { SvgIconNameTypes } from "../svgs";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor, settled, textBox } from "./support/helpers";

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
// A box-shadow value (an M3 elevation level's `var(--shadow-theme-elevation-*)`) as resolved on the page
const resolvedShadow = (page: Page, cssValue: string) =>
  page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.boxShadow = value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).boxShadow;
    probe.remove();
    return resolved;
  }, cssValue);
const css = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );
// Its box even while it's invisible, which boundingBox() doesn't give
const rect = (target: Locator) =>
  target.evaluate((el) => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x, y, width, height };
  });

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

    test("sits on surface at elevation 0, as M3's standard rail", async ({
      page,
    }) => {
      await expect(rail(page)).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface)")
      );
      await expect(rail(page)).toHaveCSS("box-shadow", "none");
    });

    test("Up and Down arrows move focus between its destinations", async ({
      page,
    }) => {
      await destination(page, "Start here").focus();
      await page.keyboard.press("ArrowDown");
      await expect(destination(page, "Components")).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(destination(page, "Tests")).toBeFocused();
      // the last stays focused
      await page.keyboard.press("ArrowDown");
      await expect(destination(page, "Tests")).toBeFocused();
      await page.keyboard.press("ArrowUp");
      await expect(destination(page, "Components")).toBeFocused();
    });

    test("hides its menu toggle, and shows its FAB unextended", async ({
      page,
    }) => {
      const fab = rail(page).getByRole("button", { name: "Search" });
      const { width, height } = (await fab.boundingBox())!;

      await expect(menuToggle(page)).toBeHidden();
      expect({ width, height }).toEqual({ width: 56, height: 56 });
      // its label is only an accessible name: visually hidden, clipped to at most a pixel
      expect(
        (await fab.locator(":scope > span:not([aria-hidden])").boundingBox())!
          .width
      ).toBeLessThanOrEqual(1);
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

    test("starts its content 44px from the top, M3's top space", async ({
      page,
    }) => {
      const fab = rail(page).getByRole("button", { name: "Search" });
      expect((await box(fab)).y).toBe(44);
    });

    test("gives each collapsed destination a 64px target, 4px apart", async ({
      page,
    }) => {
      const start = await box(destination(page, "Start here"));
      const components = await box(destination(page, "Components"));
      expect(start.height).toBe(64);
      expect(components.height).toBe(64);
      expect(components.y - start.y).toBe(68);
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

    test("opens on surface-container at elevation 2, M3's modal rail", async ({
      page,
    }) => {
      await menuToggle(page).click();
      await expect(destination(page, "Components")).toBeVisible();
      await settled(page);

      await expect(rail(page)).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container)")
      );
      // after Tailwind's transparent ring layers
      expect(await css(rail(page), "box-shadow")).toContain(
        await resolvedShadow(page, "var(--shadow-theme-elevation-2)")
      );
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

// /tests/nav-rail-expandable has its own layout with an expandable rail, labelled "Test rail",
// with centered items and its divider: "Home" (this page, with home-fill as its active icon and
// sub-items "First" and "Second"), "Badges" (a dot badge; notifications-fill as its active icon)
// and "Settings for notifications and alerts", a label too long for the 220px expanded rail.
const testNav = (page: Page) =>
  page.getByRole("navigation", { name: "Test rail", exact: true });
const testItem = (page: Page, name: string) =>
  testNav(page).getByRole("link", { name, exact: true });
const longLabel = "Settings for notifications and alerts";
// An icon's path, as its file in src/assets/svgs draws it
const iconPath = (name: SvgIconNameTypes) =>
  readFileSync(
    new URL(`../assets/svgs/${name}.svg`, import.meta.url),
    "utf8"
  ).match(/ d="([^"]+)"/)![1];

test.describe("NavRail, expandable", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/nav-rail-expandable");
  });

  test.describe("large", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("starts expanded, with its menu toggle shown and expanded", async ({
      page,
    }) => {
      await expect(menuToggle(page)).toBeVisible();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
      expect((await box(rail(page))).width).toBe(220);
    });

    test("its menu toggle collapses it and expands it again", async ({
      page,
    }) => {
      await menuToggle(page).click();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
      await settled(page);
      expect((await box(rail(page))).width).toBe(96);

      await menuToggle(page).click();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
      await settled(page);
      expect((await box(rail(page))).width).toBe(220);
    });

    test("resizing below large and back resets it to each size's default", async ({
      page,
    }) => {
      await menuToggle(page).click();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");

      await page.setViewportSize({ width: 1000, height: 800 });
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
      await menuToggle(page).click();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");

      // within medium-to-large the user's choice holds, until large resets it
      await page.setViewportSize({ width: 900, height: 800 });
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
      await menuToggle(page).click();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");

      // collapsed at large, it's collapsed below large too, so wait for a frame there for the
      // window size to change (WebKit can skip a size it only has between frames)
      await page.setViewportSize({ width: 1000, height: 800 });
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      );
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
      await settled(page);
      expect((await box(rail(page))).width).toBe(220);
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 700, height: 800 } });

    test("starts collapsed, its menu toggle 44px from the top", async ({
      page,
    }) => {
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
      expect((await box(rail(page))).width).toBe(96);
      expect((await box(menuToggle(page))).y).toBe(44);
    });

    test("labels its navigation with `label`", async ({ page }) => {
      await expect(testNav(page)).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Main", exact: true })
      ).toHaveCount(0);
    });

    test("shows the current destination's active icon, and the others' own icon", async ({
      page,
    }) => {
      await expect(testItem(page, "Home").locator("svg path")).toHaveAttribute(
        "d",
        iconPath("home-fill")
      );
      await expect(
        testItem(page, "Badges, New notification").locator("svg path")
      ).toHaveAttribute("d", iconPath("notifications"));
    });

    test("itemAlign center centers its destinations below the menu toggle and FAB", async ({
      page,
    }) => {
      const nav = await box(testNav(page));
      const first = await box(testItem(page, "Home"));
      const last = await box(testItem(page, longLabel));
      const fab = await box(rail(page).getByRole("button", { name: "Search" }));

      expect(first.y).toBeGreaterThan(fab.y + fab.height + 40);
      expect(first.y - nav.y).toBeCloseTo(
        nav.y + nav.height - (last.y + last.height),
        0
      );
    });

    test("showDivider draws an outline-variant divider on its end edge", async ({
      page,
    }) => {
      expect(await css(rail(page), "border-inline-end-width")).toBe("1px");
      expect(await css(rail(page), "border-inline-end-color")).toBe(
        await resolvedColor(page, "var(--theme-color-outline-variant)")
      );
    });

    test.describe("expanded", () => {
      test.beforeEach(async ({ page }) => {
        await menuToggle(page).click();
        await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
        await settled(page);
      });

      test("a destination's target spans the rail, beyond its indicator", async ({
        page,
      }) => {
        const nav = await box(testNav(page));
        const item = await box(testItem(page, "Badges, New notification"));

        await page.mouse.click(nav.x + nav.width - 4, item.y + item.height / 2);
        await expect(page).toHaveURL(/\/tests\/badge$/);
      });

      test("a long label wraps, and its destination grows to hold it", async ({
        page,
      }) => {
        const nav = await box(testNav(page));
        const item = testItem(page, longLabel);
        const label = await textBox(item.locator("> span:nth-child(2)"));
        const itemBox = await box(item);

        expect(label.height).toBeGreaterThanOrEqual(40);
        expect(itemBox.height).toBeGreaterThan(56);
        expect(label.y + label.height).toBeLessThanOrEqual(
          itemBox.y + itemBox.height
        );
        expect(itemBox.x + itemBox.width).toBeLessThanOrEqual(
          nav.x + nav.width
        );
      });

      test("a dot badge follows the label", async ({ page }) => {
        const item = testItem(page, "Badges, New notification");
        const label = await textBox(item.locator("> span:nth-child(2)"));
        const dot = await box(
          item.locator('span[aria-hidden="true"]').filter({ visible: true })
        );

        expect(dot.x).toBeGreaterThan(label.x + label.width);
        expect(dot.x).toBeLessThan(label.x + label.width + 12);
        expect(dot.y).toBeGreaterThan(label.y);
        expect(dot.y + dot.height).toBeLessThan(label.y + label.height);
      });

      test("Up and Down arrows move focus through its destinations and sub-items", async ({
        page,
      }) => {
        await testItem(page, "Home").focus();
        await page.keyboard.press("ArrowDown");
        await expect(testItem(page, "Badges, New notification")).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("ArrowDown");
        await expect(testItem(page, "First")).toBeFocused();
        await page.keyboard.press("ArrowUp");
        await expect(testItem(page, longLabel)).toBeFocused();
      });
    });
  });

  test.describe("compact, right to left", () => {
    test.use({ viewport: { width: 400, height: 800 } });

    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => (document.documentElement.dir = "rtl"));
      await settled(page);
    });

    test("closed, it's off the right edge, its menu toggle at the top right", async ({
      page,
    }) => {
      expect((await rect(rail(page))).x).toBeGreaterThanOrEqual(400);
      const toggle = await box(menuToggle(page));
      expect(toggle.x + toggle.width).toBe(380);
      expect(toggle.y).toBe(20);
    });

    test("opens from the right edge, its rounded corners on the left", async ({
      page,
    }) => {
      await menuToggle(page).click();
      await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
      await settled(page);

      const open = await box(rail(page));
      expect(open.x + open.width).toBe(400);
      expect(await css(rail(page), "border-top-left-radius")).toBe("16px");
      expect(await css(rail(page), "border-bottom-left-radius")).toBe("16px");
      expect(await css(rail(page), "border-top-right-radius")).toBe("0px");
      // no divider on the modal rail
      expect(await css(rail(page), "border-inline-end-width")).toBe("0px");
    });
  });
});
