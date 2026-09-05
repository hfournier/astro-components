import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';

/**
 * Shared fixture (ADR-0002): every test built on this `test` gets an axe-core
 * scan of the page after the test body runs, opt-out rather than opt-in.
 * Call `test.use({ skipA11yCheck: true })` in a describe block to opt out.
 */
export const test = base.extend<{ skipA11yCheck: boolean }>({
  skipA11yCheck: [false, { option: true }],

  page: async ({ page, skipA11yCheck }, use) => {
    await use(page);

    if (skipA11yCheck) return;

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  },
});

function formatViolations(violations: Result[]): string {
  if (violations.length === 0) return '';

  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => `  - ${node.target.join(' ')}`).join('\n');
      return `${violation.id} (${violation.impact}): ${violation.help}\n${targets}`;
    })
    .join('\n\n');
}

export { expect };
