import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Result } from "axe-core";

/**
 * Shared fixture (ADR-0002): every test built on this `test` gets an axe-core
 * scan of the page after the test body runs, opt-out rather than opt-in. The
 * scan runs in the Chromium project only (ADR-0019).
 * Call `test.use({ skipA11yCheck: true })` in a describe block to opt out.
 *
 * It also turns off the site's smooth scrolling (global.css). Firefox and
 * WebKit honour it when an action scrolls its target into view, so the target
 * is still moving when the pointer goes down: a click's mouseup can land on
 * another element, so the click goes to their common ancestor and misses its
 * target (#124), and a hover can miss :hover. Reduced motion would also make
 * the scroll instant, but it turns off the components' transitions too.
 */
export const test = base.extend<{ skipA11yCheck: boolean }>({
  skipA11yCheck: [false, { option: true }],

  page: async ({ page, skipA11yCheck }, use, testInfo) => {
    await page.addInitScript(() => {
      const instantScroll = () =>
        document.documentElement.style.setProperty(
          "scroll-behavior",
          "auto",
          "important"
        );
      if (document.documentElement) instantScroll();
      else document.addEventListener("DOMContentLoaded", instantScroll);
    });

    await use(page);

    // Scanned in Chromium only (ADR-0019): axe checks the DOM, ARIA and computed colors, which
    // come out the same in every engine, and the scan was most of each run's time
    if (skipA11yCheck || testInfo.project.name !== "chromium") return;

    // Scan the settled page: mid-transition (e.g. a dialog still fading in) axe measures
    // half-blended colors and reports contrast failures that never exist at rest. Infinite
    // animations are skipped, since they never finish; a cancelled one rejects, so it's caught.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().endTime !== Infinity
          )
          .map((animation) => animation.finished.catch(() => undefined))
      )
    );

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual(
      []
    );
  },
});

function formatViolations(violations: Result[]): string {
  if (violations.length === 0) return "";

  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => `  - ${node.target.join(" ")}`)
        .join("\n");
      return `${violation.id} (${violation.impact}): ${violation.help}\n${targets}`;
    })
    .join("\n\n");
}

export { expect };
