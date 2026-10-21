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
// count, Replies with 0, Drafts with a dot described as "New draft"), mdx-spacing-and-comments,
// rtl (default's tabs right to left), uneven-labels ("All", "Photos and videos", "Docs"),
// align-center (the same, centred), long-labels (a first label too long for two lines, in a
// 320px Tabs), and scrollable and scrollable-rtl (8 and 6 scrollable tabs in a 448px Tabs).
type TabsCaseId =
  | "default"
  | "icons"
  | "icons-and-badges"
  | "secondary-variant"
  | "secondary-variant-with-icons"
  | "secondary-variant-with-badges"
  | "mdx-spacing-and-comments"
  | "rtl"
  | "uneven-labels"
  | "align-center"
  | "long-labels"
  | "scrollable"
  | "scrollable-rtl";

const tabsCase = (page: Page, caseId: TabsCaseId) =>
  page.getByTestId(`tabs-${caseId}`);
const tablist = (page: Page, caseId: TabsCaseId) =>
  tabsCase(page, caseId).getByRole("tablist");
// The full-width row around the tablist: the divider, the scroll container and the indicator's
const tabRow = (page: Page, caseId: TabsCaseId) =>
  tabsCase(page, caseId).locator("[data-ac-tab-row]");
const indicator = (page: Page, caseId: TabsCaseId) =>
  tabRow(page, caseId).locator("[data-ac-tab-indicator]");
// A tab's content span: the primary indicator's anchor
const tabContent = (tab: Locator) => tab.locator(":scope > span");
// A tab's label (with an inline badge after it), inside its content span
const tabLabel = (tab: Locator) => tabContent(tab).locator(":scope > span");

async function indicatorRect(
  page: Page,
  caseId: TabsCaseId
): Promise<{ left: number; right: number }> {
  const rect = await box(indicator(page, caseId));
  return { left: rect.x, right: rect.x + rect.width };
}

// The indicator is CSS anchor-positioned to the selected tab - to its content span on primary tabs
// (M3's content-width indicator) - and its move is animated (--theme-duration-overlay), so poll
// until it settles onto the target's box rather than reading mid-transition.
async function waitForIndicatorToTrack(
  page: Page,
  caseId: TabsCaseId,
  target: Locator
): Promise<void> {
  await expect
    .poll(async () => {
      const [targetBox, rect] = await Promise.all([
        target.boundingBox(),
        indicatorRect(page, caseId),
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

  test("adds a count, or M3's 'New notification' for a dot, to the tab's accessible name", async ({
    page,
  }) => {
    const expectNames = async (caseId: TabsCaseId, names: string[]) => {
      const tabs = tablist(page, caseId).getByRole("tab");
      await expect(tabs).toHaveCount(names.length);
      for (const [index, name] of names.entries()) {
        await expect(tabs.nth(index)).toHaveAccessibleName(name);
      }
    };

    await expectNames("icons-and-badges", [
      "Inbox, 3",
      "Archive",
      "Updates, New notification",
    ]);
    // badgeDescription replaces "New notification"; a hidden badge of 0 adds nothing
    await expectNames("secondary-variant-with-badges", [
      "Mentions, 1500",
      "Replies",
      "Drafts, New draft",
    ]);
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
    const content = (i: number) => tabContent(tabs.nth(i));

    await waitForIndicatorToTrack(page, "default", content(0));

    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await waitForIndicatorToTrack(page, "default", content(1));
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
        .closest("[data-ac-tab-row]")!
        .querySelector("[data-ac-tab-indicator]")!
        .getBoundingClientRect();
      return indicator.top - ringBottom;
    });
    expect(gap).toBeCloseTo(1, 0);

    // an inactive tab has no indicator to avoid, so its ring fills the whole tab
    await page.keyboard.press("ArrowRight");
    const inactiveInset = await tablist(page, "default")
      .getByRole("tab")
      .nth(1)
      .evaluate((el) => getComputedStyle(el, "::after").bottom);
    expect(inactiveInset).toBe("0px");
  });

  test("the divider under the tabs is M3's 1px outline-variant rule", async ({
    page,
  }) => {
    const row = tabRow(page, "default");
    await expect(row).toHaveCSS("border-bottom-width", "1px");
    await expect(row).toHaveCSS(
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
    expect(await height(indicator(page, "default"))).toBe(3);
    expect(await height(indicator(page, "secondary-variant"))).toBe(2);
  });

  test("an inline icon is 8px from its label, and an inline badge 4px", async ({
    page,
  }) => {
    const iconTab = tablist(page, "secondary-variant-with-icons")
      .getByRole("tab")
      .first();
    const icon = await box(iconTab.locator("svg"));
    const iconLabel = await textBox(tabLabel(iconTab));
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

  test("right to left, ArrowLeft focuses the next tab and ArrowRight the previous one", async ({
    page,
  }) => {
    const tabs = tablist(page, "rtl").getByRole("tab");
    const [tab1, tab2, tab3] = [tabs.nth(0), tabs.nth(1), tabs.nth(2)];

    // the next tab is visually to the left
    expect((await box(tab2)).x).toBeLessThan((await box(tab1)).x);

    await tab1.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tab2).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tab1).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tab3).toBeFocused();

    await page.keyboard.press("Home");
    await expect(tab1).toBeFocused();
    await page.keyboard.press("End");
    await expect(tab3).toBeFocused();
  });

  test("pressing an inactive primary tab shows a primary state layer, a secondary tab an on-surface one", async ({
    page,
  }) => {
    const layerColor = (tab: Locator) =>
      tab.evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
    const press = async (tab: Locator) => {
      // the mouse works in viewport coordinates
      await tab.scrollIntoViewIfNeeded();
      const { x, y, width, height } = await box(tab);
      await page.mouse.move(x + width / 2, y + height / 2);
      await page.mouse.down();
    };
    const onSurface = await resolvedColor(
      page,
      "var(--theme-color-on-surface)"
    );

    const primaryTab = tablist(page, "default").getByRole("tab").nth(1);
    await press(primaryTab);
    expect(await layerColor(primaryTab)).toBe(
      await resolvedColor(page, "var(--theme-color-primary)")
    );
    // the label keeps its on-surface color, once its color transition ends
    await expect(primaryTab).toHaveCSS("color", onSurface);
    await page.mouse.up();

    const secondaryTab = tablist(page, "secondary-variant")
      .getByRole("tab")
      .nth(1);
    await press(secondaryTab);
    // the layer is the label's color, which transitions to on-surface
    await expect.poll(() => layerColor(secondaryTab)).toBe(onSurface);
    await page.mouse.up();
  });

  test("a fixed tab's label truncates after two lines, keeping the full label as its name", async ({
    page,
  }) => {
    const label =
      "A label long enough to need more than two lines in a narrow tab";
    const tab = tablist(page, "long-labels").getByRole("tab").first();
    const labelSpan = tabLabel(tab);

    await expect(tab).toHaveAccessibleName(label);
    // Title Small's line height is 20px
    expect((await box(labelSpan)).height).toBe(40);
    expect(
      await labelSpan.evaluate((el) => el.scrollHeight > el.clientHeight)
    ).toBe(true);
  });

  test.describe("fixed tabs", () => {
    const widths = async (page: Page, caseId: TabsCaseId) => {
      const tabs = await tablist(page, caseId).getByRole("tab").all();
      return Promise.all(tabs.map(async (tab) => (await box(tab)).width));
    };

    test("from medium up, each is as wide as the widest, the group at the start", async ({
      page,
    }) => {
      const [all, photos, docs] = await widths(page, "uneven-labels");
      expect(all).toBeCloseTo(photos!, 0);
      expect(docs).toBeCloseTo(photos!, 0);

      // "Photos and videos" fits on one line, so the widest tab is its label plus 16px each side
      const photosTab = tablist(page, "uneven-labels").getByRole("tab").nth(1);
      const photosLabel = await box(tabLabel(photosTab));
      // one line of Title Small
      expect(photosLabel.height).toBe(20);
      expect(photos).toBeCloseTo(photosLabel.width + 32, 0);

      const row = await box(tabRow(page, "uneven-labels"));
      const list = await box(tablist(page, "uneven-labels"));
      expect(list.x).toBeCloseTo(row.x, 0);
      expect(list.width).toBeLessThan(row.width);
    });

    test("align='center' centres the group, and the divider still spans the full width", async ({
      page,
    }) => {
      const row = await box(tabRow(page, "align-center"));
      const list = await box(tablist(page, "align-center"));
      expect(list.x + list.width / 2).toBeCloseTo(row.x + row.width / 2, 0);

      // the row, which draws the divider, fills the Tabs
      const tabs = await box(
        tabsCase(page, "align-center").locator("[data-ac-tablist-container]")
      );
      expect(row.width).toBeCloseTo(tabs.width, 0);
    });

    test("right to left, the group sits at the right edge", async ({
      page,
    }) => {
      const row = await box(tabRow(page, "rtl"));
      const list = await box(tablist(page, "rtl"));
      expect(list.x + list.width).toBeCloseTo(row.x + row.width, 0);
      expect(list.width).toBeLessThan(row.width);
    });

    test("selecting one doesn't scroll the page", async ({ page }) => {
      // the tab's top edge just below the top of the window, the rest of it above
      const tab = tablist(page, "default").getByRole("tab").nth(1);
      const { y } = await box(tab);
      await page.evaluate((top) => scrollTo(0, top), y + 10);
      const scrollY = await page.evaluate(() => window.scrollY);

      await tab.dispatchEvent("click");
      await expect(tab).toHaveAttribute("aria-selected", "true");
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    });

    test("below medium, they fill the width", async ({ page }) => {
      await page.setViewportSize({ width: 500, height: 800 });
      const row = await box(tabRow(page, "uneven-labels"));
      const list = await box(tablist(page, "uneven-labels"));
      expect(list.width).toBeCloseTo(row.width, 0);
    });
  });

  test.describe("scrollable tabs", () => {
    test("scroll, each tab at least 90px wide, the first 52px from the start", async ({
      page,
    }) => {
      const row = tabRow(page, "scrollable");
      expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
        true
      );

      const tabs = await tablist(page, "scrollable").getByRole("tab").all();
      for (const tab of tabs) {
        expect((await box(tab)).width).toBeGreaterThanOrEqual(90);
      }
      expect((await box(tabs[0]!)).x - (await box(row)).x).toBeCloseTo(52, 0);
    });

    test("right to left, the first tab is 52px from the right edge", async ({
      page,
    }) => {
      const row = await box(tabRow(page, "scrollable-rtl"));
      const first = await box(
        tablist(page, "scrollable-rtl").getByRole("tab").first()
      );
      expect(row.x + row.width - (first.x + first.width)).toBeCloseTo(52, 0);
    });

    test("arrowing to an off-screen tab scrolls it into view, and the indicator follows it", async ({
      page,
    }) => {
      const row = tabRow(page, "scrollable");
      const tabs = tablist(page, "scrollable").getByRole("tab");
      const last = tabs.last();

      const isInView = async (tab: Locator) => {
        const [r, t] = [await box(row), await box(tab)];
        return t.x >= r.x - 1 && t.x + t.width <= r.x + r.width + 1;
      };
      expect(await isInView(last)).toBe(false);

      // ArrowLeft from the first tab wraps to the last, which is off-screen
      await tabs.first().focus();
      await page.keyboard.press("ArrowLeft");
      await expect(last).toBeFocused();
      await expect.poll(() => isInView(last)).toBe(true);

      await page.keyboard.press("Enter");
      await waitForIndicatorToTrack(page, "scrollable", tabContent(last));

      // scrolled back to the start, the indicator stays under the selected (now off-screen) tab
      await row.evaluate((el) => el.scrollTo({ left: 0 }));
      await waitForIndicatorToTrack(page, "scrollable", tabContent(last));
    });
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
