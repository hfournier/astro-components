import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box } from "./support/helpers";

// Each case on /tests/nav-bar-item holds one NavBar, labelled with its heading. badges: Inbox
// (3, current), Updates (a dot), Chat (1500) and Archive (0). badge-description: Updates (a dot,
// described in French), Inbox and Archive. rtl: Inbox (3), Updates (a dot) and Archive, right to
// left.
// The badge is the item's visible aria-hidden <span>.
const navNames = {
  badges: "Badges",
  "badge-description": "Badge description",
  rtl: "Right to left",
} as const;
type NavBarItemCaseId = keyof typeof navNames;

const nav = (page: Page, caseId: NavBarItemCaseId) =>
  page
    .getByTestId(`nav-bar-item-${caseId}`)
    .getByRole("navigation", { name: navNames[caseId], exact: true });
const link = (page: Page, name: string, caseId: NavBarItemCaseId = "badges") =>
  nav(page, caseId).getByRole("link", { name, exact: true });
const badge = (page: Page, name: string, caseId?: NavBarItemCaseId) =>
  link(page, name, caseId)
    .locator('span[aria-hidden="true"]')
    .filter({ visible: true });
const icon = (page: Page, name: string, caseId?: NavBarItemCaseId) =>
  link(page, name, caseId).locator("svg");

test.describe("NavBarItem", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/nav-bar-item");
  });

  test("adds a count, or M3's 'New notification' for a dot, to the item's accessible name", async ({
    page,
  }) => {
    for (const name of [
      "Inbox, 3",
      "Updates, New notification",
      "Chat, 1500",
      "Archive",
    ]) {
      await expect(link(page, name)).toBeVisible();
    }
  });

  test("badgeDescription replaces a dot's 'New notification'", async ({
    page,
  }) => {
    await expect(
      link(page, "Updates, Nouvelle notification", "badge-description")
    ).toBeVisible();
  });

  test.describe("compact", () => {
    test.use({ viewport: { width: 400, height: 800 } });

    test("shows a count, a dot, 999+ or no badge", async ({ page }) => {
      await expect(badge(page, "Inbox, 3")).toHaveText("3");
      expect((await box(badge(page, "Updates, New notification"))).width).toBe(
        6
      );
      await expect(badge(page, "Chat, 1500")).toHaveText("999+");
      await expect(badge(page, "Archive")).toHaveCount(0);
    });

    test("anchors its badges to the top-end corner of the icon", async ({
      page,
    }) => {
      const dotIcon = await box(icon(page, "Updates, New notification"));
      const dot = await box(badge(page, "Updates, New notification"));
      expect(dot.y).toBeCloseTo(dotIcon.y, 0);
      expect(dot.x + dot.width).toBeCloseTo(dotIcon.x + dotIcon.width, 0);

      const countIcon = await box(icon(page, "Inbox, 3"));
      const count = await box(badge(page, "Inbox, 3"));
      expect(count.x).toBeLessThan(countIcon.x + countIcon.width);
      expect(count.y).toBeLessThan(countIcon.y);
    });

    test("right to left, anchors its badges to the icon's top-left corner, its trailing corner there", async ({
      page,
    }) => {
      const dotIcon = await box(icon(page, "Updates, New notification", "rtl"));
      const dot = await box(badge(page, "Updates, New notification", "rtl"));
      expect(dot.y).toBeCloseTo(dotIcon.y, 0);
      expect(dot.x).toBeCloseTo(dotIcon.x, 0);

      const countIcon = await box(icon(page, "Inbox, 3", "rtl"));
      const count = await box(badge(page, "Inbox, 3", "rtl"));
      expect(count.x + count.width).toBeCloseTo(countIcon.x + 12, 0);
      expect(count.y).toBeCloseTo(countIcon.y - 2, 0);
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 900, height: 800 } });

    test("keeps its badges, dot or count, on the icon's top-end corner, as below medium", async ({
      page,
    }) => {
      const dotIcon = await box(icon(page, "Updates, New notification"));
      const dot = await box(badge(page, "Updates, New notification"));
      expect(dot.y).toBeCloseTo(dotIcon.y, 0);
      expect(dot.x + dot.width).toBeCloseTo(dotIcon.x + dotIcon.width, 0);

      const countIcon = await box(icon(page, "Inbox, 3"));
      const count = await box(badge(page, "Inbox, 3"));
      expect(count.x).toBeCloseTo(countIcon.x + 12, 0);
      expect(count.y).toBeCloseTo(countIcon.y - 2, 0);
    });

    test("shows a large count whole, over the gap and the label rather than clipped", async ({
      page,
    }) => {
      const count = badge(page, "Chat, 1500");
      await expect(count).toHaveText("999+");
      const countBox = await box(count);
      expect(countBox.height).toBe(16);
      // nothing between it and the item clips it
      const clipped = await count.evaluate((element) => {
        const clippers: string[] = [];
        for (
          let ancestor = element.parentElement;
          ancestor && ancestor.tagName !== "A";
          ancestor = ancestor.parentElement
        ) {
          if (getComputedStyle(ancestor).overflow !== "visible")
            clippers.push(ancestor.className);
        }
        return clippers;
      });
      expect(clipped).toEqual([]);
    });

    test("in a bar too narrow for its labels' shares, still doesn't break a word", async ({
      page,
    }) => {
      // the case's bar is narrower than a window's, so a quarter of it is less than these labels
      for (const name of ["Updates, New notification", "Archive"]) {
        const label = link(page, name).locator("> span > span:last-child");
        expect((await box(label)).height).toBe(16);
      }
    });

    test("right to left, anchors a count to the icon's top-left corner", async ({
      page,
    }) => {
      const countIcon = await box(icon(page, "Inbox, 3", "rtl"));
      const count = await box(badge(page, "Inbox, 3", "rtl"));
      expect(count.x + count.width).toBeCloseTo(countIcon.x + 12, 0);
      expect(count.y).toBeCloseTo(countIcon.y - 2, 0);
    });
  });
});
