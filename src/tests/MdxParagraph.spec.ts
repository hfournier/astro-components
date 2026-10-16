import type { Locator } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";

// MDX renders Markdown paragraphs through src/internal/mdx/P.astro, which spaces them 0.75em apart
// but leaves no top margin on one that starts its container, so a component holding a single
// paragraph (a Popover, a Details) keeps its text centred in its padding. Like the site-layout
// specs, this has no test page of its own: it checks paragraphs on component test pages.
const margins = (paragraph: Locator) =>
  paragraph.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      top: parseFloat(style.marginTop),
      em: parseFloat(style.fontSize),
      isFirstChild: el.parentElement!.firstElementChild === el,
    };
  });

test.describe("MDX paragraphs", () => {
  test("a paragraph that starts its container has no top margin", async ({
    page,
  }) => {
    await page.goto("/tests/details");
    const paragraph = page
      .getByTestId("details-initially-open")
      .locator("details p");

    const { top, isFirstChild } = await margins(paragraph);
    expect(isFirstChild).toBe(true);
    expect(top).toBe(0);
  });

  test("a paragraph after another element keeps its 0.75em top margin", async ({
    page,
  }) => {
    await page.goto("/tests/dialog");
    const paragraph = page
      .getByTestId("dialog-basic")
      .getByText("Dialog supporting text.");

    const { top, em, isFirstChild } = await margins(paragraph);
    expect(isFirstChild).toBe(false);
    expect(top).toBeCloseTo(em * 0.75, 1);
  });
});
