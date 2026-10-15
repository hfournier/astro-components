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
});
