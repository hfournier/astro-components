import type { Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";
import { box, expectFocusRing, resolvedColor } from "../../test/helpers";

test.describe("Details", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/details");
  });

  // The usage example plus the four named examples render as the only <details>
  // on the page (each source block beside a preview is highlighted <pre> text,
  // not elements). DOM order: usage, example-01 (open by default), example-02
  // (with icon), example-03 (plain), example-04 (dense). Scoped through the
  // CodePreview (data-testid="code-preview") wrappers.
  const allDetails = (page: Page) =>
    page.getByTestId("code-preview").locator("details");
  const withIcon = (page: Page) =>
    allDetails(page).filter({ hasText: "Details Heading with Icon" });
  const withoutBorders = (page: Page) => allDetails(page).nth(3);
  const dense = (page: Page) =>
    allDetails(page).filter({ hasText: "Dense Details Heading" });

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

    // leading icon + chevron - both size-6, distinguished by data attribute
    // rather than their (shared) size class
    await expect(summary.locator("svg")).toHaveCount(2);

    const leadingIcon = summary.locator("svg[data-ac-details-icon]");
    await expect(leadingIcon).toHaveCount(1);
    await expect(leadingIcon).toHaveAttribute("aria-hidden", "true");

    // an aria-hidden icon must not leak into the accessible name
    await expect(summary).toHaveAccessibleName("Details Heading with Icon");
  });

  test("chevron rotates when open", async ({ page }) => {
    const chevron = (details: ReturnType<typeof allDetails>) =>
      details.locator("summary svg[data-ac-details-chevron]");

    await expect(chevron(allDetails(page).first())).toHaveCSS("rotate", "none");
    await expect(
      chevron(page.getByTestId("code-preview").locator("details[open]"))
    ).toHaveCSS("rotate", "180deg");
  });

  test("respects prefers-reduced-motion: transitions off, disclosure still opens", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const details = allDetails(page).first();
    const chevron = details.locator("summary svg[data-ac-details-chevron]");

    await expect(chevron).toHaveCSS("transition-duration", "0s");

    await details.locator("summary").focus();
    await page.keyboard.press("Enter");

    await expect(details).toHaveJSProperty("open", true);
    await expect(
      details.getByText("Details content", { exact: true })
    ).toBeVisible();
  });

  test("the outlined variant is an M3 outlined card, and the plain variant the same size without a visible border", async ({
    page,
  }) => {
    const outlined = allDetails(page).first();
    const plain = withoutBorders(page);

    await expect(outlined).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-outline-variant)")
    );
    await expect(plain).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    expect((await box(plain)).height).toBe((await box(outlined)).height);
  });

  test("a closed details is just its summary and border, with no gap below the summary", async ({
    page,
  }) => {
    const details = allDetails(page).first();
    await expect(details).toHaveJSProperty("open", false);

    const detailsHeight = (await box(details)).height;
    const summaryHeight = (await box(details.locator("summary"))).height;
    expect(detailsHeight).toBe(summaryHeight + 2);
  });

  test("summary is M3's 56px one-line list item, with a 24px chevron", async ({
    page,
  }) => {
    const summary = allDetails(page).first().locator("summary");
    const chevron = summary.locator("svg[data-ac-details-chevron]");

    expect((await box(summary)).height).toBe(56);
    expect((await box(chevron)).width).toBe(24);
  });

  test("dense size is a 48px summary", async ({ page }) => {
    expect((await box(dense(page).locator("summary"))).height).toBe(48);
  });

  test("hovering the summary shows the M3 state layer", async ({ page }) => {
    const summary = allDetails(page).first().locator("summary");
    // With smooth scrolling, the summary is still moving when hover() scrolls it into view and
    // puts the pointer on it, and WebKit doesn't apply :hover until the pointer moves again.
    // Reduced motion makes the scroll instant.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await summary.hover();

    await expect
      .poll(() =>
        summary.evaluate((el) => getComputedStyle(el, "::before").opacity)
      )
      .toBe("0.08");
  });

  test("focusing the summary shows the focus ring", async ({ page }) => {
    const summary = allDetails(page).first().locator("summary");
    await summary.focus();

    await expectFocusRing(summary, { inset: true });
  });
});
