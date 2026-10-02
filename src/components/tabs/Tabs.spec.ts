import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

async function resolvedStyle(
  page: Page,
  property: string,
  cssValue: string
): Promise<string> {
  return page.evaluate(
    ({ property, cssValue }) => {
      const probe = document.createElement("div");
      probe.style.setProperty(property, cssValue);
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).getPropertyValue(property);
      probe.remove();
      return resolved;
    },
    { property, cssValue }
  );
}

async function indicatorRect(
  page: Page
): Promise<{ left: number; right: number }> {
  return page.evaluate(() => {
    const indicator = document
      .querySelectorAll('[role="tablist"]')[0]!
      .querySelector("[data-ac-tab-indicator]") as HTMLElement;
    const rect = indicator.getBoundingClientRect();
    return { left: rect.left, right: rect.right };
  });
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
      const [box, rect] = await Promise.all([
        target.boundingBox(),
        indicatorRect(page),
      ]);
      if (!box) return null;
      return (
        Math.abs(rect.left - box.x) < 1 &&
        Math.abs(rect.right - (box.x + box.width)) < 1
      );
    })
    .toBe(true);
}

test.describe("Tabs", () => {
  // The demo now lives on the shared doc page at /components/tabs: the Usage block plus
  // example-01/02. Every test drives the first tablist on the page (the Usage one) via
  // `.first()`; the source block beside each preview is highlighted <pre> text, which
  // carries no runtime role="tablist"/data-ac-tablist-container, so it never matches.
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/tabs");
  });

  test("arrow keys move focus with roving tabindex", async ({ page }) => {
    const tabs = page.getByRole("tablist").first().getByRole("tab");
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
    const tabs = page.getByRole("tablist").first().getByRole("tab");
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
    const group = page.locator("[data-ac-tablist-container]").first();
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

  test("clicking a tab's label or badge selects that tab", async ({
    page,
  }) => {
    // The Badges example (last on the page): a click on the label text or the inline badge
    // targets the tab's inner spans, not the button itself
    const group = page.locator("[data-ac-tablist-container]").last();
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
    const tabs = page.getByRole("tablist").first().getByRole("tab");
    const content = (i: number) => tabs.nth(i).locator(":scope > span");

    await waitForIndicatorToTrack(page, content(0));

    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");

    await waitForIndicatorToTrack(page, content(1));
  });

  test("hovering a tab shows the M3 state layer", async ({ page }) => {
    const tab3 = page.getByRole("tablist").first().getByRole("tab").nth(2);

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

  test("tab labels use M3's Title Small type style", async ({ page }) => {
    const tab = page.getByRole("tablist").first().getByRole("tab").first();
    await expect(tab).toHaveCSS("font-size", "14px");
    await expect(tab).toHaveCSS("line-height", "20px");
    await expect(tab).toHaveCSS("font-weight", "500");
    await expect(tab).toHaveCSS("letter-spacing", "0.1px");
  });

  test("tab focus ring is a 3px inset ring in the focus-ring-on-bg color", async ({
    page,
  }) => {
    const expectedColor = await resolvedStyle(
      page,
      "color",
      "var(--theme-color-focus-ring-on-bg)"
    );

    const tabs = page.getByRole("tablist").first().getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");

    // The ring is drawn on ::after (so it can stop short of the indicator), which toHaveCSS can't read
    const ring = await tabs
      .nth(1)
      .evaluate((el) => getComputedStyle(el, "::after").boxShadow);
    expect(ring).toMatch(
      new RegExp(
        `${expectedColor.replace(/[()]/g, "\\$&")} 0px 0px 0px 3px inset`
      )
    );
  });

  test("only the selected tab's focus ring stops 1px above the indicator", async ({
    page,
  }) => {
    const tab = page.getByRole("tablist").first().getByRole("tab").first();
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
    const expectedColor = await resolvedStyle(
      page,
      "border-bottom-color",
      "var(--theme-color-outline-variant)"
    );
    const tablist = page.getByRole("tablist").first();
    await expect(tablist).toHaveCSS("border-bottom-width", "1px");
    await expect(tablist).toHaveCSS("border-bottom-color", expectedColor);
  });
});
