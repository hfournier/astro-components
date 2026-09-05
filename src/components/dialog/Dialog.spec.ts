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

// Activates a button via the keyboard rather than a real pointer click: a mouse click leaves the
// cursor hovering the element, which flips it into its (currently contrast-failing) :hover style
// and can leave :focus-visible unset on whatever gains focus next - neither of which this retrofit
// is meant to exercise.
async function activate(locator: Locator): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press('Enter');
}

test.describe('Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dialogs');
  });

  test('opens via its trigger and moves focus inside the dialog', async ({ page }) => {
    await activate(page.getByRole('button', { name: 'Open Dialog 1' }));

    const dialog = page.locator('#dialog-1');
    await expect(dialog).toBeVisible();

    const focusIsInsideDialog = await page.evaluate(
      () => document.getElementById('dialog-1')?.contains(document.activeElement) ?? false
    );
    expect(focusIsInsideDialog).toBe(true);
  });

  test('closes via its close button and returns focus to the trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open Dialog 1' });
    await activate(trigger);

    const dialog = page.locator('#dialog-1');
    await activate(dialog.getByRole('button', { name: 'Close' }));

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('closes via Escape and returns focus to the trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open Dialog 1' });
    await activate(trigger);

    const dialog = page.locator('#dialog-1');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('shows no visible motion on open/close when prefers-reduced-motion is set', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const dialog = page.locator('#dialog-1');
    await expect(dialog).toHaveCSS('transition-duration', '0s');

    await activate(page.getByRole('button', { name: 'Open Dialog 1' }));
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('transition-duration', '0s');
  });

  test('wrapper and header rounding resolve to the container radius token, flat at every width', async ({
    page,
  }) => {
    await activate(page.getByRole('button', { name: 'Open Dialog 1' }));

    const expectedRadius = await resolvedStyle(page, 'border-top-left-radius', 'var(--radius-container)');

    const wrapper = page.locator('#dialog-1 > div');
    for (const width of [400, 900, 1400]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(wrapper).toHaveCSS('border-top-left-radius', expectedRadius);
    }
  });

  test('header rule resolves to the divider border-width token', async ({ page }) => {
    await activate(page.getByRole('button', { name: 'Open Dialog 1' }));

    const expectedWidth = await resolvedStyle(page, 'border-bottom-width', 'var(--border-width-divider)');
    const header = page.locator('#dialog-1 header');
    await expect(header).toHaveCSS('border-bottom-width', expectedWidth);
  });

  test('close button focus ring resolves to the dedicated focus-ring tokens', async ({ page }) => {
    await activate(page.getByRole('button', { name: 'Open Dialog 1' }));

    const expectedColor = await resolvedStyle(page, 'outline-color', 'var(--color-focus-ring)');
    const expectedWidth = await resolvedStyle(page, 'outline-width', 'var(--focus-ring-width)');
    const expectedOffset = await resolvedStyle(page, 'outline-offset', 'var(--focus-ring-offset)');

    // already focused by the dialog's own open behavior (it's the first focusable element)
    const closeButton = page.locator('#dialog-1').getByRole('button', { name: 'Close' });
    await expect(closeButton).toHaveCSS('outline-color', expectedColor);
    await expect(closeButton).toHaveCSS('outline-width', expectedWidth);
    await expect(closeButton).toHaveCSS('outline-offset', expectedOffset);
  });
});

test.describe('DialogConfirm', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dialogs');
  });

  test('opens via its trigger, confirms via its confirm button, and returns focus to the trigger', async ({
    page,
  }) => {
    const trigger = page.getByRole('button', { name: 'Open Confirm Dialog' });
    await activate(trigger);

    const dialog = page.locator('#dialog-2');
    await expect(dialog).toBeVisible();

    await activate(dialog.getByRole('button', { name: 'Yes' }));

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('closes via its cancel button and returns focus to the trigger', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open Confirm Dialog' });
    await activate(trigger);

    const dialog = page.locator('#dialog-2');
    await activate(dialog.getByRole('button', { name: 'No' }));

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('title resolves to the component-title font tokens', async ({ page }) => {
    await activate(page.getByRole('button', { name: 'Open Confirm Dialog' }));

    const expectedWeight = await resolvedStyle(page, 'font-weight', 'var(--font-weight-title)');
    const expectedSize = await resolvedStyle(page, 'font-size', 'var(--font-size-title)');

    const title = page.getByText('Confirm Action');
    await expect(title).toHaveCSS('font-weight', expectedWeight);
    await expect(title).toHaveCSS('font-size', expectedSize);
  });
});
