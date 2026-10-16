import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { resolvedColor } from "./support/helpers";

// Footer is BaseWrapper with `as` fixed to <footer>; BaseWrapper.spec.ts covers every background role.
// This file keeps only what's Footer's own: the element it renders and passing props through.
// Each case on /tests/footer is a Section with data-testid="footer-<caseId>" holding one <footer>;
// the bg-color case's is on secondary-container.
type FooterCaseId = "bg-color";

const footer = (page: Page, caseId: FooterCaseId) =>
  page.getByTestId(`footer-${caseId}`).locator("footer");

test.describe("Footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/footer");
  });

  test("renders a native <footer> and passes bgColor through to BaseWrapper", async ({
    page,
  }) => {
    const target = footer(page, "bg-color");

    await expect(target).toHaveJSProperty("tagName", "FOOTER");
    await expect(target).not.toHaveAttribute("as");
    await expect(target).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-secondary-container)")
    );
  });
});
