import { existsSync, readdirSync } from "node:fs";
import { test, expect } from "../tests/support/a11y-fixture";

// Component specs drive the /tests pages, not the docs (ADR-0015), so this is the one spec that
// visits each component's docs page: the a11y fixture's axe scan runs on each, catching an example
// that breaks accessibility. An example that throws already fails the build. The ids come from the
// components collection's files (src/docs/<id>/documentation.mdx), so a new component is covered
// without touching this file.
const docsDir = new URL("../docs/", import.meta.url);
const componentIds = readdirSync(docsDir, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(new URL(`${entry.name}/documentation.mdx`, docsDir))
  )
  .map((entry) => entry.name)
  .sort();

test.describe("Docs pages", () => {
  for (const id of componentIds) {
    test(`/components/${id} renders and passes axe`, async ({ page }) => {
      const response = await page.goto(`/components/${id}`);
      expect(response?.status()).toBe(200);
      // first: the page's title (Heading's own examples include an h1)
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible();
    });
  }

  // A fenced code block in a docs page's MDX is Markdown's, highlighted by Astro's own Shiki
  // config: it takes the site's code themes and looks like an Example's code, following the
  // colour scheme, and the fixture's axe scan then checks its comments' contrast in that scheme
  // (#256). ChipInput's Editing section has a block with comments.
  for (const scheme of ["light", "dark"] as const) {
    test(`a Markdown code block matches an Example's code, ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/components/chip-input");
      const block = page
        .locator("pre.astro-code")
        .filter({ hasText: 'recipients?.addEventListener("edit"' });
      const example = page
        .getByTestId("code-preview")
        .first()
        .locator("pre.astro-code");
      const style = (target: typeof block) =>
        target.evaluate((el) => {
          const { backgroundColor, padding } = getComputedStyle(el);
          return { backgroundColor, padding };
        });
      expect(await style(block)).toEqual(await style(example));
      expect((await style(block)).padding).toBe("16px");
      await expect(
        block.getByText(/^\s*\/\/ "Fabian Reza" opens/)
      ).toBeVisible();
    });
  }

  // SheetBottom's page has every section: When to use it and Accessibility from their own files,
  // Usage, its documentation.mdx body (Anatomy...), Properties, Slots and Examples
  test("sections render in a fixed order, matching the table of contents", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/components/sheet-bottom");

    // Overview, the first link, goes to the top of the page, so it's left out
    const toc = await page
      .getByRole("navigation", { name: "Table of contents" })
      .getByRole("link")
      .evaluateAll((anchors) => {
        const entries = anchors.slice(1).map((a) => ({
          text: a.textContent!.trim(),
          target: document.getElementById(
            decodeURIComponent((a as HTMLAnchorElement).hash.slice(1))
          ),
        }));
        return entries.map(({ text, target }, i) => {
          const previous = entries[i - 1]?.target;
          return {
            text,
            targetText: target?.textContent?.trim(),
            followsPrevious:
              !previous ||
              (!!target &&
                !!(
                  previous.compareDocumentPosition(target) &
                  Node.DOCUMENT_POSITION_FOLLOWING
                )),
          };
        });
      });

    for (const { text, targetText, followsPrevious } of toc) {
      expect(targetText, text).toBe(text);
      expect(followsPrevious, text).toBe(true);
    }

    const sections = [
      "When to use it",
      "Usage",
      "Anatomy",
      "Accessibility",
      "Properties",
      "Slots",
      "Examples",
    ];
    expect(
      toc.map(({ text }) => text).filter((text) => sections.includes(text))
    ).toEqual(sections);
  });
});
