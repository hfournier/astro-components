import { test, expect } from '../test/a11y-fixture';

test('renders the tabs demo page', async ({ page }) => {
  await page.goto('/tabs');

  await expect(page.getByRole('tab', { name: 'Tab 1' }).first()).toBeVisible();
  await expect(page.getByRole('tabpanel').first()).toContainText('Lorem ipsum');
});
