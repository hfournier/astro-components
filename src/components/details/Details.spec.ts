import type { Page } from "@playwright/test";
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

test.describe("Details", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/details");
  });

  // The usage example plus the two named examples render as the only <details>
  // on the page (each source block beside a preview is highlighted <pre> text,
  // not elements). DOM order: usage, example-01 (open by default), example-02
  // (with icon). Scoped through the CodePreview (data-testid="code-preview") wrappers.
  const allDetails = (page: Page) =>
    page.getByTestId("code-preview").locator("details");
  const withIcon = (page: Page) =>
    allDetails(page).filter({ hasText: "Details Heading with Icon" });

  test("summary toggles its content open and closed from the keyboard", async ({
    page,
  }) => {
    const details = allDetails(page).first();
    const summary = details.locator("summary");
    const content = details.getByText("Details content", { exact: true });

    await expect(details).toHaveJSProperty("open", false);
    await expect(content).toBeHidden();

    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveJSProperty("open", true);
    await expect(content).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(details).toHaveJSProperty("open", false);
    await expect(content).toBeHidden();
  });

  test("summary exposes the label as its accessible name, with no heading element", async ({
    page,
  }) => {
    const summary = allDetails(page).first().locator("summary");

    await expect(summary).toHaveAccessibleName("Details Heading");
    await expect(summary.getByRole("heading")).toHaveCount(0);
  });

  test("renders expanded on load when the open prop is set", async ({
    page,
  }) => {
    const opened = page.getByTestId("code-preview").locator("details[open]");

    await expect(opened).toHaveCount(1);
    await expect(
      opened.getByText("Lorem ipsum", { exact: false })
    ).toBeVisible();
  });

  test("leading icon renders in the summary and stays hidden from assistive tech", async ({
    page,
  }) => {
    const summary = withIcon(page).locator("summary");

    // leading icon (size-4) + chevron (size-5)
    await expect(summary.locator("svg")).toHaveCount(2);

    const leadingIcon = summary.locator("svg.size-4");
    await expect(leadingIcon).toHaveCount(1);
    await expect(leadingIcon).toHaveAttribute("aria-hidden", "true");

    // an aria-hidden icon must not leak into the accessible name
    await expect(summary).toHaveAccessibleName("Details Heading with Icon");
  });

  test("chevron rotates when open and transitions on the overlay duration token", async ({
    page,
  }) => {
    const expectedDuration = await resolvedStyle(
      page,
      "transition-duration",
      "var(--duration-overlay)"
    );

    const closedChevron = allDetails(page)
      .first()
      .locator("summary svg.size-5");
    await expect(closedChevron).toHaveCSS(
      "transition-duration",
      expectedDuration
    );
    await expect(closedChevron).toHaveCSS("rotate", "none");

    const openChevron = page
      .getByTestId("code-preview")
      .locator("details[open]")
      .locator("summary svg.size-5");
    await expect(openChevron).toHaveCSS("rotate", "180deg");
  });

  test("respects prefers-reduced-motion: transitions off, disclosure still opens", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const details = allDetails(page).first();
    const chevron = details.locator("summary svg.size-5");

    await expect(chevron).toHaveCSS("transition-duration", "0s");

    await details.locator("summary").focus();
    await page.keyboard.press("Enter");

    await expect(details).toHaveJSProperty("open", true);
    await expect(
      details.getByText("Details content", { exact: true })
    ).toBeVisible();
  });
});
