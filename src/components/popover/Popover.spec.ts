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

// Keyboard activation (focus + Enter) rather than a real pointer click, matching Dialog.spec.ts:
// a real click leaves the cursor hovering the element, which flips it into Button's (currently
// contrast-failing) :hover style - not something this retrofit's tests should exercise.
async function activate(locator: Locator): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press('Enter');
}

test.describe('Popover', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/popovers');
  });

  test('opens via its trigger without moving focus off it', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open Popover 1' });
    await activate(trigger);

    await expect(page.locator('#popover-1')).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('closes via its close button and returns focus to the trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open Popover 3' });
    await activate(trigger);

    const popover = page.locator('#popover-3');
    await activate(popover.getByRole('button', { name: 'Close' }));

    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('closes via Escape and returns focus to the trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open Popover 1' });
    await activate(trigger);

    const popover = page.locator('#popover-1');
    await expect(popover).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('shows no visible motion on open/close when prefers-reduced-motion is set', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const popover = page.locator('#popover-1');
    await expect(popover).toHaveCSS('transition-duration', '0s');

    await activate(page.getByRole('button', { name: 'Open Popover 1' }));
    await expect(popover).toBeVisible();
    await expect(popover).toHaveCSS('transition-duration', '0s');

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(popover).toHaveCSS('transition-duration', '0s');
  });

  test('wrapper rounding resolves to the container radius token, flat at every width', async ({ page }) => {
    await activate(page.getByRole('button', { name: 'Open Popover 1' }));

    const expectedRadius = await resolvedStyle(page, 'border-radius', 'var(--radius-container)');

    const wrapper = page.locator('#popover-1 > div');
    for (const width of [400, 900, 1400]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(wrapper).toHaveCSS('border-top-left-radius', expectedRadius);
    }
  });

  test('close button keeps rounded-full regardless of the container radius token', async ({ page }) => {
    await activate(page.getByRole('button', { name: 'Open Popover 3' }));

    const closeButton = page.locator('#popover-3').getByRole('button', { name: 'Close' });
    const radius = await closeButton.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    // rounded-full resolves to an effectively-infinite radius (browsers differ on the exact huge
    // number), well past --radius-container - it just needs to stay a pill, not the container radius.
    expect(radius).toBeGreaterThan(1000);
  });

  test("close button's edge resolves to the divider border-width token", async ({ page }) => {
    await activate(page.getByRole('button', { name: 'Open Popover 3' }));

    const expectedWidth = await resolvedStyle(page, 'border-top-width', 'var(--border-width-divider)');
    const closeButton = page.locator('#popover-3').getByRole('button', { name: 'Close' });
    await expect(closeButton).toHaveCSS('border-top-width', expectedWidth);
  });

  test('close button focus ring resolves to the dedicated focus-ring tokens', async ({ page }) => {
    await activate(page.getByRole('button', { name: 'Open Popover 3' }));

    const expectedColor = await resolvedStyle(page, 'outline-color', 'var(--color-focus-ring)');
    const expectedWidth = await resolvedStyle(page, 'outline-width', 'var(--focus-ring-width)');
    const expectedOffset = await resolvedStyle(page, 'outline-offset', 'var(--focus-ring-offset)');

    const closeButton = page.locator('#popover-3').getByRole('button', { name: 'Close' });
    await closeButton.focus();
    await expect(closeButton).toHaveCSS('outline-color', expectedColor);
    await expect(closeButton).toHaveCSS('outline-width', expectedWidth);
    await expect(closeButton).toHaveCSS('outline-offset', expectedOffset);
  });
});
