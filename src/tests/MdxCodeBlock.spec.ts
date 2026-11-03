import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { resolvedColor } from "./support/helpers";

// MDX renders fenced code blocks with Astro's Shiki config, in the site's code themes,
// github-light-default and github-dark-default, following the colour scheme through
// light-dark(), and src/internal/mdx/Pre.astro draws them as an Example's or Usage's code is:
// on surface-container-lowest with 16px of padding. Astro's default theme, github-dark in both
// schemes, drew comments at 3.05:1, and the fixture's axe scan, run in each scheme, checks the
// comments' contrast (#256). Each case on /tests/mdx-code-block is a Section with
// data-testid="mdx-code-block-<caseId>" holding one fenced block.
type MdxCodeBlockCaseId = "comment";

const codeBlock = (page: Page, caseId: MdxCodeBlockCaseId) =>
  page.getByTestId(`mdx-code-block-${caseId}`).locator("pre");

test.describe("MDX code blocks", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`in the ${scheme} scheme, a code block takes the ${scheme} code theme, on surface-container-lowest`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/tests/mdx-code-block");
      const block = codeBlock(page, "comment");
      await expect(block).toHaveClass(/\bastro-code\b/);
      await expect(block).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-lowest)")
      );
      await expect(block).toHaveCSS("padding", "16px");
      // The theme's text colour: github-light-default's #1f2328, github-dark-default's #e6edf3
      await expect(block).toHaveCSS(
        "color",
        scheme === "light" ? "rgb(31, 35, 40)" : "rgb(230, 237, 243)"
      );
      await expect(block.getByText("// A comment")).toBeVisible();
    });
  }
});
