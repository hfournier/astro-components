import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { SvgIconNameTypes } from "../svgs";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/nav-bar holds one `static` NavBar, its <nav> labelled with the case's name,
// found by that label so the spec still checks the label reaches it.
// - three-destinations: Home (current, with home-fill as its active icon), Search and Settings
//   (settings-fill as its active icon)
// - five-destinations: Home (current), Search, Inbox, Chat and Saved
// - long-label: Home (current), a label too long for a third of the bar, and Search
// - reselect: "This page" (/tests/nav-bar, this page), "Tests" (/tests, current as this page's
//   parent) and "Components"
const navNames = {
  "three-destinations": "Three destinations",
  "five-destinations": "Five destinations",
  "long-label": "Long label",
  reselect: "Re-select",
} as const;
type NavBarCaseId = keyof typeof navNames;

const longLabel = "Notifications, privacy and security settings";

const bar = (page: Page, caseId: NavBarCaseId = "three-destinations") =>
  page.getByTestId(`nav-bar-${caseId}`).locator("[data-ac-nav-bar]");
const nav = (page: Page, caseId: NavBarCaseId = "three-destinations") =>
  bar(page, caseId).getByRole("navigation", {
    name: navNames[caseId],
    exact: true,
  });
const item = (
  page: Page,
  name: string,
  caseId: NavBarCaseId = "three-destinations"
) => nav(page, caseId).getByRole("link", { name, exact: true });
const items = (page: Page, caseId: NavBarCaseId) =>
  nav(page, caseId).getByRole("link");
// The current item's active indicator: the icon's 56x32 pill below medium, the content span
// holding icon and label from medium up
const iconIndicator = (page: Page, name: string) =>
  item(page, name).locator("svg").locator("..");
const content = (page: Page, name: string) =>
  item(page, name).locator("> span").first();
const label = (
  page: Page,
  name: string,
  caseId: NavBarCaseId = "three-destinations"
) => item(page, name, caseId).getByText(name, { exact: true });
// An icon's path, as its file in src/assets/svgs draws it
const iconPath = (name: SvgIconNameTypes) =>
  readFileSync(
    new URL(`../assets/svgs/${name}.svg`, import.meta.url),
    "utf8"
  ).match(/ d="([^"]+)"/)![1];
// Whether a label shows all its text: no ellipsis, nothing cut off
const isFullyShown = (page: Page, name: string, caseId: NavBarCaseId) =>
  label(page, name, caseId).evaluate(
    (el) =>
      getComputedStyle(el).textOverflow !== "ellipsis" &&
      el.scrollWidth <= el.clientWidth &&
      el.scrollHeight <= el.clientHeight
  );

test.describe("NavBar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/nav-bar");
  });

  test("shows the current item's activeIcon, and the others' icon", async ({
    page,
  }) => {
    await expect(item(page, "Home").locator("svg path")).toHaveAttribute(
      "d",
      iconPath("home-fill")
    );
    await expect(item(page, "Settings").locator("svg path")).toHaveAttribute(
      "d",
      iconPath("settings")
    );
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

    test("wraps a long label rather than truncating it, and grows to hold it", async ({
      page,
    }) => {
      expect(await isFullyShown(page, longLabel, "long-label")).toBe(true);
      expect(
        (await box(label(page, longLabel, "long-label"))).height
      ).toBeGreaterThanOrEqual(32);
      expect((await box(bar(page, "long-label"))).height).toBeGreaterThan(64);
    });

    test("at twice the text size, shows every label in full", async ({
      page,
    }) => {
      const before = (await box(bar(page))).height;
      await page.evaluate(
        () => (document.documentElement.style.fontSize = "200%")
      );

      for (const name of ["Home", "Search", "Settings"]) {
        expect(await isFullyShown(page, name, "three-destinations")).toBe(true);
      }
      expect((await box(bar(page))).height).toBeGreaterThan(before);
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 830, height: 800 } });

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

    // Compose's centered arrangement: the items take 60%, 70% or 80% of the bar for 3, 4 or 5
    // items, in equal shares, with the rest split between the ends. The test page's column is
    // too narrow for every label to fit its share, so the bar is widened to a window's width.
    for (const [caseId, count, share] of [
      ["three-destinations", 3, 0.6],
      ["five-destinations", 5, 0.8],
    ] as const) {
      test(`gives ${count} horizontal items equal widths, ${share * 100}% of the bar, centered`, async ({
        page,
      }) => {
        await bar(page, caseId).evaluate((el) => (el.style.width = "1000px"));
        const barBox = await box(bar(page, caseId));
        const boxes = await Promise.all(
          (await items(page, caseId).all()).map((link) => box(link))
        );
        const widths = boxes.map((b) => b.width);
        const first = boxes[0];
        const last = boxes[boxes.length - 1];

        expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
        expect(last.x + last.width - first.x).toBeCloseTo(
          barBox.width * share,
          0
        );
        expect(first.x - barBox.x).toBeCloseTo(
          barBox.x + barBox.width - (last.x + last.width),
          0
        );
      });
    }

    test("widens an item for a long label, up to its share of the bar, keeping the group centered", async ({
      page,
    }) => {
      const barBox = await box(bar(page, "long-label"));
      const home = await box(item(page, "Home", "long-label"));
      const long = await box(item(page, longLabel, "long-label"));
      const search = await box(item(page, "Search", "long-label"));

      expect(long.width).toBeGreaterThan(home.width);
      expect(long.width).toBeLessThanOrEqual(barBox.width / 3 + 0.5);
      expect(home.x - barBox.x).toBeCloseTo(
        barBox.x + barBox.width - (search.x + search.width),
        0
      );
      expect(await isFullyShown(page, longLabel, "long-label")).toBe(true);
    });
  });

  test.describe("re-selecting", () => {
    test.beforeEach(async ({ page }) => {
      // room to scroll, and a marker a reload would clear
      await page.evaluate(() => {
        document.body.style.minHeight = "4000px";
        (window as unknown as { marker: boolean }).marker = true;
      });
    });

    test("the current destination scrolls the page to the top, without navigating", async ({
      page,
    }) => {
      await item(page, "This page", "reselect").scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 1000));
      await item(page, "This page", "reselect").click();

      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      expect(
        await page.evaluate(
          () => (window as unknown as { marker?: boolean }).marker
        )
      ).toBe(true);
      await expect(page).toHaveURL(/\/tests\/nav-bar$/);
    });

    test("a parent of the current page still navigates to it", async ({
      page,
    }) => {
      await expect(item(page, "Tests", "reselect")).toHaveAttribute(
        "aria-current",
        "page"
      );
      await item(page, "Tests", "reselect").click();
      await expect(page).toHaveURL(/\/tests$/);
    });
  });
});
