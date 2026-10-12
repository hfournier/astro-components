import type { Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

// The "Badges" example's NavBar: Inbox (3, current), Updates (a dot), Chat (1500) and Archive (0).
// An item with a count renders it twice, on the icon (below medium) and after the label (from
// medium up), so this finds the shown one: the item's visible aria-hidden <span>.
const nav = (page: Page) =>
  page.getByRole("navigation", { name: "Badges", exact: true });
const link = (page: Page, name: string) =>
  nav(page).getByRole("link", { name, exact: true });
const badge = (page: Page, name: string) =>
  link(page, name)
    .locator('span[aria-hidden="true"]')
    .filter({ visible: true });
const icon = (page: Page, name: string) => link(page, name).locator("svg");

test.describe("NavBarItem", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/nav-bar-item");
  });

  test("adds a count to the item's accessible name", async ({ page }) => {
    for (const name of ["Inbox, 3", "Updates", "Chat, 1500", "Archive"]) {
      await expect(link(page, name)).toBeVisible();
    }
  });

  test.describe("compact", () => {
    test.use({ viewport: { width: 400, height: 800 } });

    test("shows a count, a dot, 999+ or no badge", async ({ page }) => {
      await expect(badge(page, "Inbox, 3")).toHaveText("3");
      await expect(badge(page, "Updates")).toHaveCSS("width", "6px");
      await expect(badge(page, "Chat, 1500")).toHaveText("999+");
      await expect(badge(page, "Archive")).toHaveCount(0);
    });

    test("anchors its badges to the top-end corner of the icon", async ({
      page,
    }) => {
      const dotIcon = (await icon(page, "Updates").boundingBox())!;
      const dot = (await badge(page, "Updates").boundingBox())!;
      expect(dot.y).toBeCloseTo(dotIcon.y, 0);
      expect(dot.x + dot.width).toBeCloseTo(dotIcon.x + dotIcon.width, 0);

      const countIcon = (await icon(page, "Inbox, 3").boundingBox())!;
      const count = (await badge(page, "Inbox, 3").boundingBox())!;
      expect(count.x).toBeLessThan(countIcon.x + countIcon.width);
      expect(count.y).toBeLessThan(countIcon.y);
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 900, height: 800 } });

    test("keeps a dot on the icon, and moves a count after the label", async ({
      page,
    }) => {
      const dotIcon = (await icon(page, "Updates").boundingBox())!;
      const dot = (await badge(page, "Updates").boundingBox())!;
      expect(dot.x + dot.width).toBeCloseTo(dotIcon.x + dotIcon.width, 0);

      // The label span holds the label's text, then the inline badge
      const label = link(page, "Chat, 1500").locator(
        "> span:first-child > span:last-child"
      );
      const labelBox = (await label.boundingBox())!;
      const countIcon = (await icon(page, "Chat, 1500").boundingBox())!;
      await expect(badge(page, "Chat, 1500")).toHaveText("999+");
      const count = (await badge(page, "Chat, 1500").boundingBox())!;
      // clear of the icon and the label's text, and inside the label's line
      expect(count.x).toBeGreaterThan(countIcon.x + countIcon.width + 4);
      expect(count.x + count.width).toBeCloseTo(labelBox.x + labelBox.width, 0);
      expect(count.y).toBeGreaterThanOrEqual(labelBox.y - 1);
    });

    test("doesn't clip the bottom of a count after the label", async ({
      page,
    }) => {
      const count = badge(page, "Chat, 1500");
      await expect(count).toHaveCSS("height", "16px");
      // The count hangs below the label's line, so no element in the item that clips its
      // overflow may end above the count's bottom
      const clipped = await count.evaluate((element) => {
        const bottom = element.getBoundingClientRect().bottom;
        const clippers: string[] = [];
        for (
          let ancestor = element.parentElement;
          ancestor && ancestor.tagName !== "A";
          ancestor = ancestor.parentElement
        ) {
          if (
            getComputedStyle(ancestor).overflowY !== "visible" &&
            ancestor.getBoundingClientRect().bottom < bottom
          )
            clippers.push(ancestor.className);
        }
        return clippers;
      });
      expect(clipped).toEqual([]);
    });
  });
});
