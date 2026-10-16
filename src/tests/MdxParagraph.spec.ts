import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";

// MDX renders Markdown paragraphs through src/internal/mdx/P.astro, which spaces them 0.75em apart
// but leaves no top margin on one that starts its container, so a component holding a single
// paragraph (a Popover, a Details) keeps its text centred in its padding. Each case on
// /tests/mdx-paragraph is a Section with data-testid="mdx-paragraph-<caseId>" holding one paragraph.
type MdxParagraphCaseId = "first-in-container" | "after-element";

const paragraph = (page: Page, caseId: MdxParagraphCaseId) =>
  page.getByTestId(`mdx-paragraph-${caseId}`).locator("p");

const topMarginAndPosition = (target: Locator) =>
  target.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      marginTop: parseFloat(style.marginTop),
      fontSize: parseFloat(style.fontSize),
      isFirstChild: el.parentElement!.firstElementChild === el,
    };
  });

test.describe("MDX paragraphs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/mdx-paragraph");
  });

  test("a paragraph that starts its container has no top margin", async ({
    page,
  }) => {
    const { marginTop, isFirstChild } = await topMarginAndPosition(
      paragraph(page, "first-in-container")
    );
    expect(isFirstChild).toBe(true);
    expect(marginTop).toBe(0);
  });

  test("a paragraph after another element keeps its 0.75em top margin", async ({
    page,
  }) => {
    const { marginTop, fontSize, isFirstChild } = await topMarginAndPosition(
      paragraph(page, "after-element")
    );
    expect(isFirstChild).toBe(false);
    expect(marginTop).toBeCloseTo(fontSize * 0.75, 1);
  });
});
