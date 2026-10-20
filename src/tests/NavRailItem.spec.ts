import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box } from "./support/helpers";

// Each case on /tests/nav-rail-item holds a collapsed rail's items in a nav labelled with its
// heading. badges: Inbox (3), Updates (a dot) and Archive (none). badge-description: Updates (a
// dot, described in French). rtl: Inbox (3) and Updates (a dot), right to left.
// Collapsed, an item's count is on its icon; the copy after the label is hidden, so this finds the
// shown one: the item's visible aria-hidden <span>.
const navNames = {
  badges: "Badges",
  "badge-description": "Badge description",
  rtl: "Right to left",
} as const;
type NavRailItemCaseId = keyof typeof navNames;

const link = (page: Page, caseId: NavRailItemCaseId, name: string) =>
  page
    .getByTestId(`nav-rail-item-${caseId}`)
    .getByRole("navigation", { name: navNames[caseId], exact: true })
    .getByRole("link", { name, exact: true });
const badge = (page: Page, caseId: NavRailItemCaseId, name: string) =>
  link(page, caseId, name)
    .locator('span[aria-hidden="true"]')
    .filter({ visible: true });
const icon = (page: Page, caseId: NavRailItemCaseId, name: string) =>
  link(page, caseId, name).locator("svg");

test.describe("NavRailItem", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/nav-rail-item");
  });

  test("adds a count, or M3's 'New notification' for a dot, to the item's accessible name", async ({
    page,
  }) => {
    for (const name of ["Inbox, 3", "Updates, New notification", "Archive"]) {
      await expect(link(page, "badges", name)).toBeVisible();
    }
  });

  test("badgeDescription replaces a dot's 'New notification'", async ({
    page,
  }) => {
    await expect(
      link(page, "badge-description", "Updates, Nouvelle notification")
    ).toBeVisible();
  });

  test("right to left, anchors its badges to the icon's top-left corner, its trailing corner there", async ({
    page,
  }) => {
    const name = "Updates, New notification";
    const dotIcon = await box(icon(page, "rtl", name));
    const dot = await box(badge(page, "rtl", name));
    expect(dot.y).toBeCloseTo(dotIcon.y, 0);
    expect(dot.x).toBeCloseTo(dotIcon.x, 0);

    const countIcon = await box(icon(page, "rtl", "Inbox, 3"));
    const count = await box(badge(page, "rtl", "Inbox, 3"));
    expect(count.x + count.width).toBeCloseTo(countIcon.x + 12, 0);
    expect(count.y).toBeCloseTo(countIcon.y - 2, 0);
  });
});
