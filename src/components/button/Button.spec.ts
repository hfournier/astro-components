import type { Page } from '@playwright/test';
import { test, expect } from '../../test/a11y-fixture';

const COMBINATIONS = ['Solid Primary', 'Solid Secondary', 'Outline Primary', 'Outline Secondary'];

async function resolvedColor(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement('div');
    probe.style.color = value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssValue);
}

test.describe('Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/buttons');
  });

  test('renders every variant/color combination via the color prop', async ({ page }) => {
    for (const name of COMBINATIONS) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
  });

  test('solid variant resolves the color-role background', async ({ page }) => {
    const primary = await resolvedColor(page, 'var(--color-primary-700)');
    const secondary = await resolvedColor(page, 'var(--color-secondary-600)');

    await expect(page.getByRole('button', { name: 'Solid Primary' })).toHaveCSS('background-color', primary);
    await expect(page.getByRole('button', { name: 'Solid Secondary' })).toHaveCSS('background-color', secondary);
  });

  test('outline variant resolves the color-role border and text', async ({ page }) => {
    const primary = await resolvedColor(page, 'var(--color-primary-700)');
    const secondary = await resolvedColor(page, 'var(--color-secondary-600)');

    const outlinePrimary = page.getByRole('button', { name: 'Outline Primary' });
    await expect(outlinePrimary).toHaveCSS('border-color', primary);
    await expect(outlinePrimary).toHaveCSS('color', primary);

    const outlineSecondary = page.getByRole('button', { name: 'Outline Secondary' });
    await expect(outlineSecondary).toHaveCSS('border-color', secondary);
    await expect(outlineSecondary).toHaveCSS('color', secondary);
  });

  test('focus ring resolves to the dedicated tokens regardless of color', async ({ page }) => {
    const expectedColor = await resolvedColor(page, 'var(--color-focus-ring)');
    const [expectedWidth, expectedOffset] = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return [
        root.getPropertyValue('--focus-ring-width').trim(),
        root.getPropertyValue('--focus-ring-offset').trim(),
      ];
    });

    for (const name of COMBINATIONS) {
      const button = page.getByRole('button', { name });
      await button.focus();
      await expect(button).toHaveCSS('outline-color', expectedColor);
      await expect(button).toHaveCSS('outline-width', expectedWidth);
      await expect(button).toHaveCSS('outline-offset', expectedOffset);
    }
  });
});
