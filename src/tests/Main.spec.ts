import { test, expect } from "./support/a11y-fixture";

// Main is BaseWrapper with `as` fixed to <main>; BaseWrapper.spec.ts covers every background role.
// A page has only one <main>, so no case on /tests/main holds a Main: this file checks the one
// the page's route wraps its content in, with the main-page-content case inside it.
test.describe("Main", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/main");
  });

  test("renders the page's only <main>, with the id SkipToContent targets", async ({
    page,
  }) => {
    const main = page.getByRole("main");

    await expect(main).toHaveCount(1);
    await expect(main).toHaveJSProperty("tagName", "MAIN");
    await expect(main).toHaveAttribute("id", "main-content");
    await expect(main).not.toHaveAttribute("as");
    await expect(main.getByTestId("main-page-content")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Skip to content" })
    ).toHaveAttribute("href", "#main-content");
  });
});
