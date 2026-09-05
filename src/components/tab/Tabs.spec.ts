import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../test/a11y-fixture';

async function resolvedStyle(page: Page, property: string, cssValue: string): Promise<string> {
  return page.evaluate(
    ({ property, cssValue }) => {
      const probe = document.createElement('div');
      probe.style.setProperty(property, cssValue);
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).getPropertyValue(property);
      probe.remove();
      return resolved;
    },
    { property, cssValue }
  );
}

async function indicatorRect(page: Page, anchor: 'hover' | 'selected'): Promise<{ left: number; right: number }> {
  const index = anchor === 'hover' ? 0 : 1;
  return page.evaluate(
    (index) => {
      const tablist = document.querySelectorAll('[role="tablist"]')[0] as HTMLElement;
      const indicator = tablist.querySelectorAll(':scope > div')[index] as HTMLElement;
      const rect = indicator.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    },
    index
  );
}

// The sliding indicator's position is CSS anchor-positioned to whichever tab currently carries the
// matching anchor-name, and its move is animated (--duration-overlay) - poll until it settles onto
// the target tab's box rather than reading mid-transition.
async function waitForIndicatorToTrack(page: Page, anchor: 'hover' | 'selected', target: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const [box, rect] = await Promise.all([target.boundingBox(), indicatorRect(page, anchor)]);
      if (!box) return null;
      return Math.abs(rect.left - box.x) < 1 && Math.abs(rect.right - (box.x + box.width)) < 1;
    })
    .toBe(true);
}

test.describe('Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tabs');
  });

  test('arrow keys move focus with roving tabindex', async ({ page }) => {
    const tabs = page.getByRole('tablist').first().getByRole('tab');
    const [tab1, tab2, tab3] = [tabs.nth(0), tabs.nth(1), tabs.nth(2)];

    await tab1.focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab2).toBeFocused();
    await expect(tab2).toHaveAttribute('tabindex', '0');
    await expect(tab1).toHaveAttribute('tabindex', '-1');

    await page.keyboard.press('ArrowRight');
    await expect(tab3).toBeFocused();

    // wraps around
    await page.keyboard.press('ArrowRight');
    await expect(tab1).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(tab3).toBeFocused();
    await expect(tab3).toHaveAttribute('tabindex', '0');
  });

  test('Home and End move focus to the first and last tab', async ({ page }) => {
    const tabs = page.getByRole('tablist').first().getByRole('tab');
    const [tab1, , tab3] = [tabs.nth(0), tabs.nth(1), tabs.nth(2)];

    await tab1.focus();
    await page.keyboard.press('End');
    await expect(tab3).toBeFocused();

    await page.keyboard.press('Home');
    await expect(tab1).toBeFocused();
  });

  test('selecting a tab shows its panel and hides the others', async ({ page }) => {
    const group = page.locator('[data-hfdev-tablist-container]').first();
    const tabs = group.getByRole('tab');
    // getByRole('tabpanel') excludes panels hidden via [hidden] from the accessibility tree, so a
    // plain attribute selector is used here to see all of them regardless of visibility.
    const panels = group.locator('[role="tabpanel"]');

    await expect(panels.nth(0)).toBeVisible();
    await expect(panels.nth(1)).toBeHidden();

    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(panels.nth(0)).toBeHidden();
    await expect(panels.nth(1)).toBeVisible();
  });

  test('the sliding indicator follows the selected tab', async ({ page }) => {
    const tabs = page.getByRole('tablist').first().getByRole('tab');
    const tab2 = tabs.nth(1);

    await waitForIndicatorToTrack(page, 'selected', tabs.nth(0));

    await tabs.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await waitForIndicatorToTrack(page, 'selected', tab2);
  });

  test('the sliding indicator follows the hovered tab', async ({ page }) => {
    const tabs = page.getByRole('tablist').first().getByRole('tab');
    const tab3 = tabs.nth(2);

    await tab3.hover();

    await waitForIndicatorToTrack(page, 'hover', tab3);

    // Leave the pointer on the tab: the automatic axe scan (ADR-0002) runs after this test
    // body while it's still hovered, and doubles as the regression check for #25's hover
    // color-contrast fix.
  });

  test('tab labels resolve to the nav font tokens', async ({ page }) => {
    const expectedWeight = await resolvedStyle(page, 'font-weight', 'var(--font-weight-nav)');
    const expectedSize = await resolvedStyle(page, 'font-size', 'var(--font-size-nav)');

    const tab = page.getByRole('tablist').first().getByRole('tab').first();
    await expect(tab).toHaveCSS('font-weight', expectedWeight);
    await expect(tab).toHaveCSS('font-size', expectedSize);
  });

  test('tab focus ring resolves to the dedicated focus-ring tokens', async ({ page }) => {
    const expectedColor = await resolvedStyle(page, 'outline-color', 'var(--color-focus-ring)');
    const expectedWidth = await resolvedStyle(page, 'outline-width', 'var(--focus-ring-width)');
    const expectedOffset = await resolvedStyle(page, 'outline-offset', 'var(--focus-ring-offset)');

    const tab = page.getByRole('tablist').first().getByRole('tab').first();
    await tab.focus();
    await expect(tab).toHaveCSS('outline-color', expectedColor);
    await expect(tab).toHaveCSS('outline-width', expectedWidth);
    await expect(tab).toHaveCSS('outline-offset', expectedOffset);
  });

  test('container rule resolves to the divider border-width token', async ({ page }) => {
    const expectedWidth = await resolvedStyle(page, 'border-bottom-width', 'var(--border-width-divider)');
    const tablist = page.getByRole('tablist').first();
    await expect(tablist).toHaveCSS('border-bottom-width', expectedWidth);
  });
});
