import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  expectFocusRing,
  resolvedColor,
  textBox,
} from "./support/helpers";

// Each case on /tests/tabs is a Section with data-testid="tabs-<caseId>" holding one Tabs. These
// are the ones this spec uses: default (primary, labels only), icons (primary with stacked icons),
// icons-and-badges (primary with icons, Updates with a dot badge), secondary-variant (labels only),
// secondary-variant-with-icons (inline icons), secondary-variant-with-badges (Mentions with a
// count, Replies, Drafts with a dot) and mdx-spacing-and-comments.
type TabsCaseId =
  | "default"
  | "icons"
  | "icons-and-badges"
  | "secondary-variant"
  | "secondary-variant-with-icons"
  | "secondary-variant-with-badges"
  | "mdx-spacing-and-comments";

const tabsCase = (page: Page, caseId: TabsCaseId) =>
  page.getByTestId(`tabs-${caseId}`);
const tablist = (page: Page, caseId: TabsCaseId) =>
  tabsCase(page, caseId).getByRole("tablist");

async function indicatorRect(
  page: Page
): Promise<{ left: number; right: number }> {
  const rect = await box(
    tablist(page, "default").locator("[data-ac-tab-indicator]")
  );
  return { left: rect.x, right: rect.x + rect.width };
}

// The indicator is CSS anchor-positioned to the selected tab - to its content span on primary tabs
// (M3's content-width indicator) - and its move is animated (--theme-duration-overlay), so poll
// until it settles onto the target's box rather than reading mid-transition.
async function waitForIndicatorToTrack(
  page: Page,
  target: Locator
): Promise<void> {
  await expect
    .poll(async () => {
      const [targetBox, rect] = await Promise.all([
        target.boundingBox(),
        indicatorRect(page),
      ]);
      if (!targetBox) return null;
      return (
        Math.abs(rect.left - targetBox.x) < 1 &&
        Math.abs(rect.right - (targetBox.x + targetBox.width)) < 1
      );
    })
    .toBe(true);
}

test.describe("Tabs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/tabs");
  });

  test("arrow keys move focus with roving tabindex", async ({ page }) => {
    const tabs = tablist(page, "default").getByRole("tab");
    const [tab1, tab2, tab3] = [tabs.nth(0), tabs.nth(1), tabs.nth(2)];

    await tab1.focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab2).toBeFocused();
    await expect(tab2).toHaveAttribute("tabindex", "0");
    await expect(tab1).toHaveAttribute("tabindex", "-1");

    await page.keyboard.press("ArrowRight");
    await expect(tab3).toBeFocused();

    // wraps around
    await page.keyboard.press("ArrowRight");
    await expect(tab1).toBeFocused();

    await page.keyboard.press("ArrowLeft");
    await expect(tab3).toBeFocused();
    await expect(tab3).toHaveAttribute("tabindex", "0");
  });

  test("Home and End move focus to the first and last tab", async ({
    page,
  }) => {
    const tabs = tablist(page, "default").getByRole("tab");
    const [tab1, , tab3] = [tabs.nth(0), tabs.nth(1), tabs.nth(2)];

    await tab1.focus();
    await page.keyboard.press("End");
    await expect(tab3).toBeFocused();

    await page.keyboard.press("Home");
    await expect(tab1).toBeFocused();
  });

  test("selecting a tab shows its panel and hides the others", async ({
    page,
  }) => {
    const group = tabsCase(page, "default").locator(
      "[data-ac-tablist-container]"
    );
    const tabs = group.getByRole("tab");
    // getByRole('tabpanel') excludes panels hidden via [hidden] from the accessibility tree, so a
    // plain attribute selector is used here to see all of them regardless of visibility.
    const panels = group.locator('[role="tabpanel"]');

    await expect(panels.nth(0)).toBeVisible();
    await expect(panels.nth(1)).toBeHidden();

    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(panels.nth(0)).toBeHidden();
    await expect(panels.nth(1)).toBeVisible();
  });

  test("clicking a tab's label or badge selects that tab", async ({ page }) => {
    // A click on the label text or the inline badge targets the tab's inner spans, not the
    // button itself
    const group = tabsCase(page, "secondary-variant-with-badges").locator(
      "[data-ac-tablist-container]"
    );
    const tabs = group.getByRole("tab");
    const panels = group.locator('[role="tabpanel"]');

    await tabs.nth(2).getByText("Drafts").click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(panels.nth(2)).toBeVisible();

    await tabs.nth(0).locator("[aria-hidden='true']").click();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(panels.nth(0)).toBeVisible();
    await expect(panels.nth(2)).toBeHidden();
  });

  test("the sliding indicator follows the selected tab's content", async ({
    page,
  }) => {
    const tabs = tablist(page, "default").getByRole("tab");
    const content = (i: number) => tabs.nth(i).locator(":scope > span");

    await waitForIndicatorToTrack(page, content(0));

    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await waitForIndicatorToTrack(page, content(1));
  });

  test("hovering a tab shows the M3 state layer", async ({ page }) => {
    const tab3 = tablist(page, "default").getByRole("tab").nth(2);

    await tab3.hover();

    await expect
      .poll(() =>
        tab3.evaluate((el) => getComputedStyle(el, "::before").opacity)
      )
      .toBe("0.08");

    // Leave the pointer on the tab: the automatic axe scan (ADR-0002) runs after this test
    // body while it's still hovered, and doubles as the regression check for #25's hover
    // color-contrast fix.
  });

  test("focusing a tab shows the focus ring", async ({ page }) => {
    const tabs = tablist(page, "default").getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");

    // drawn on ::after, so it can stop short of the indicator
    await expectFocusRing(tabs.nth(1), { inset: true, pseudo: "::after" });
  });

  test("only the selected tab's focus ring stops 1px above the indicator", async ({
    page,
  }) => {
    const tab = tablist(page, "default").getByRole("tab").first();
    await tab.focus();

    const gap = await tab.evaluate((el) => {
      const tabRect = el.getBoundingClientRect();
      const ringBottom =
        tabRect.bottom - parseFloat(getComputedStyle(el, "::after").bottom);
      const indicator = el
        .closest('[role="tablist"]')!
        .querySelector("[data-ac-tab-indicator]")!
        .getBoundingClientRect();
      return indicator.top - ringBottom;
    });
    expect(gap).toBeCloseTo(1, 0);

    // an inactive tab has no indicator to avoid, so its ring fills the whole tab
    await page.keyboard.press("ArrowRight");
    const inactiveInset = await page
      .getByRole("tablist")
      .first()
      .getByRole("tab")
      .nth(1)
      .evaluate((el) => getComputedStyle(el, "::after").bottom);
    expect(inactiveInset).toBe("0px");
  });

  test("the divider under the tabs is M3's 1px outline-variant rule", async ({
    page,
  }) => {
    const defaultTablist = tablist(page, "default");
    await expect(defaultTablist).toHaveCSS("border-bottom-width", "1px");
    await expect(defaultTablist).toHaveCSS(
      "border-bottom-color",
      await resolvedColor(page, "var(--theme-color-outline-variant)")
    );
  });

  const height = async (target: Locator) => (await box(target)).height;

  test("tabs are 48px high with labels only, 64px with stacked 24px icons", async ({
    page,
  }) => {
    expect(
      await height(tablist(page, "default").getByRole("tab").first())
    ).toBe(48);
    expect(
      await height(tablist(page, "secondary-variant").getByRole("tab").first())
    ).toBe(48);
    expect(await height(tablist(page, "icons").getByRole("tab").first())).toBe(
      64
    );
    expect(
      (await box(tablist(page, "icons").locator("svg").first())).width
    ).toBe(24);
  });

  test("the primary indicator is 3px high, the secondary 2px", async ({
    page,
  }) => {
    const indicator = (caseId: TabsCaseId) =>
      tablist(page, caseId).locator("[data-ac-tab-indicator]");

    expect(await height(indicator("default"))).toBe(3);
    expect(await height(indicator("secondary-variant"))).toBe(2);
  });

  test("an inline icon is 8px from its label, and an inline badge 4px", async ({
    page,
  }) => {
    const iconTab = tablist(page, "secondary-variant-with-icons")
      .getByRole("tab")
      .first();
    const icon = await box(iconTab.locator("svg"));
    const iconLabel = await textBox(iconTab.locator(":scope > span"));
    expect(iconLabel.x - (icon.x + icon.width)).toBeCloseTo(8, 0);

    const badge = tablist(page, "secondary-variant-with-badges")
      .getByRole("tab")
      .first()
      .locator('span[aria-hidden="true"]');
    const badgeLabel = await textBox(badge.locator(".."));
    expect(
      (await box(badge)).x - (badgeLabel.x + badgeLabel.width)
    ).toBeCloseTo(4, 0);
  });

  test("a dot badge on a stacked icon overlaps it by 6px", async ({ page }) => {
    const tab = tablist(page, "icons-and-badges").getByRole("tab", {
      name: "Updates",
    });
    const icon = await box(tab.locator("svg"));
    const dot = await box(tab.locator('span[aria-hidden="true"]'));

    // the dot sits inside the icon's top-end corner
    expect(icon.x + icon.width - dot.x).toBeCloseTo(6, 0);
    expect(dot.y + dot.height - icon.y).toBeCloseTo(6, 0);
  });
});

// Tabs finds its Tabs among its slot's top-level nodes. Anything else there throws, so it can't be
// silently dropped from the page; /tests/tabs-content renders each kind of content and lists what
// it rendered or the error it threw.
test.describe("Tabs content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/tabs-content");
  });

  const outcome = (page: Page, content: string) =>
    page.getByTestId(`tabs-content-${content}`);

  test("ignores comments between its Tabs", async ({ page }) => {
    await expect(outcome(page, "comments")).toHaveText("rendered 2 tabs");
  });

  test("throws when it has no Tabs", async ({ page }) => {
    await expect(outcome(page, "empty")).toHaveText(
      "Tabs: expected at least one Tab as a direct child, but found none."
    );
  });

  test("throws on a Tab wrapped in another element", async ({ page }) => {
    await expect(outcome(page, "wrapped")).toHaveText(
      /^Tabs: found a Tab wrapped in <div>, .*direct child/
    );
  });

  test("throws on another element, naming it", async ({ page }) => {
    await expect(outcome(page, "element")).toHaveText(
      /^Tabs: found <h2>, but only Tab components can go in Tabs/
    );
  });

  test("throws on text, quoting it", async ({ page }) => {
    await expect(outcome(page, "text")).toHaveText(
      /^Tabs: found "Some stray words", /
    );
  });

  // MDX turns text on its own line into a paragraph, and the paragraph is what Tabs sees
  test("in MDX, its Tabs can be spaced out and commented", async ({ page }) => {
    await page.goto("/tests/tabs");
    await expect(
      tablist(page, "mdx-spacing-and-comments").getByRole("tab")
    ).toHaveCount(3);
  });
});
