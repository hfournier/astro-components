import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, expectFocusRing, resolvedColor } from "./support/helpers";

// Each case the spec uses on /tests/details is a Section with data-testid="details-<caseId>"
// holding one Details: default (closed, outlined, "Details content"), initially-open,
// with-icon, plain-variant and dense.
type DetailsCaseId =
  "default" | "initially-open" | "with-icon" | "plain-variant" | "dense";

const details = (page: Page, caseId: DetailsCaseId) =>
  page.getByTestId(`details-${caseId}`).locator("details");
const chevron = (target: Locator) =>
  target.locator("summary svg[data-ac-details-chevron]");

test.describe("Details", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/details");
  });

  test("summary toggles its content open and closed from the keyboard", async ({
    page,
  }) => {
    const target = details(page, "default");
    const summary = target.locator("summary");
    const content = target.getByText("Details content", { exact: true });

    await expect(target).toHaveJSProperty("open", false);
    await expect(content).toBeHidden();

    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(target).toHaveJSProperty("open", true);
    await expect(content).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(target).toHaveJSProperty("open", false);
    await expect(content).toBeHidden();
  });

  test("summary exposes the label as its accessible name, with no heading element", async ({
    page,
  }) => {
    const summary = details(page, "default").locator("summary");

    await expect(summary).toHaveAccessibleName("Details Heading");
    await expect(summary.getByRole("heading")).toHaveCount(0);
  });

  test("renders expanded on load when the open prop is set", async ({
    page,
  }) => {
    const opened = details(page, "initially-open").and(page.locator("[open]"));

    await expect(opened).toHaveCount(1);
    await expect(
      opened.getByText("Lorem ipsum", { exact: false })
    ).toBeVisible();
  });

  test("leading icon renders in the summary and stays hidden from assistive tech", async ({
    page,
  }) => {
    const summary = details(page, "with-icon").locator("summary");

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
    await expect(chevron(details(page, "default"))).toHaveCSS("rotate", "none");
    await expect(chevron(details(page, "initially-open"))).toHaveCSS(
      "rotate",
      "180deg"
    );
  });

  test("respects prefers-reduced-motion: transitions off, disclosure still opens", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const target = details(page, "default");
    await expect(chevron(target)).toHaveCSS("transition-duration", "0s");

    await target.locator("summary").focus();
    await page.keyboard.press("Enter");

    await expect(target).toHaveJSProperty("open", true);
    await expect(
      target.getByText("Details content", { exact: true })
    ).toBeVisible();
  });

  test("the outlined variant is an M3 outlined card, and the plain variant the same size without a visible border", async ({
    page,
  }) => {
    const outlined = details(page, "default");
    const plain = details(page, "plain-variant");

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
    const target = details(page, "default");
    await expect(target).toHaveJSProperty("open", false);

    const detailsHeight = (await box(target)).height;
    const summaryHeight = (await box(target.locator("summary"))).height;
    expect(detailsHeight).toBe(summaryHeight + 2);
  });

  test("summary is M3's 56px one-line list item, with a 24px chevron", async ({
    page,
  }) => {
    const target = details(page, "default");

    expect((await box(target.locator("summary"))).height).toBe(56);
    expect((await box(chevron(target))).width).toBe(24);
  });

  test("dense size is a 48px summary", async ({ page }) => {
    expect((await box(details(page, "dense").locator("summary"))).height).toBe(
      48
    );
  });

  test("hovering the summary shows the M3 state layer", async ({ page }) => {
    const summary = details(page, "default").locator("summary");
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
    const summary = details(page, "default").locator("summary");
    await summary.focus();

    await expectFocusRing(summary, { inset: true });
  });
});
