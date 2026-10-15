import { test, expect } from "../../tests/support/a11y-fixture";

// Main is BaseWrapper with `as` fixed to <main>; BaseWrapper.spec.ts covers every background role.
// A page has only one <main>, so Main has no live preview: this file checks the one every page
// gets from its layout, on Main's own docs page.
test.describe("Main", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/main");
  });

  test("renders the page's only <main>, with the id SkipToContent targets", async ({
    page,
  }) => {
    const main = page.getByRole("main");

    await expect(main).toHaveCount(1);
    await expect(main).toHaveJSProperty("tagName", "MAIN");
    await expect(main).toHaveAttribute("id", "main-content");
    await expect(main).not.toHaveAttribute("as");
    await expect(
      page.getByRole("link", { name: "Skip to content" })
    ).toHaveAttribute("href", "#main-content");
  });
});
