import { test, expect } from "./support/a11y-fixture";

// A modal Dialog, SheetSide and SheetBottom render their headline row in a <header> (and
// Dialog and SheetSide their actions in a <footer>). Outside <main> and any sectioning element, a
// bare <header> or <footer> is a banner or contentinfo landmark, which an overlay's title row and
// buttons aren't. /tests/overlay-landmarks places one of each outside <main>.
const overlays = [
  {
    name: "Dialog",
    trigger: "Open dialog",
    headline: "Dialog headline",
    action: "Done",
  },
  {
    name: "SheetSide",
    trigger: "Open side sheet",
    headline: "Side sheet headline",
    action: "Save",
  },
  {
    name: "SheetBottom",
    trigger: "Open bottom sheet",
    headline: "Bottom sheet headline",
  },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/overlay-landmarks");
});

for (const { name, trigger, headline, action } of overlays) {
  test(`an open modal ${name} outside <main> adds no banner or contentinfo landmark`, async ({
    page,
  }) => {
    await page.getByRole("button", { name: trigger }).click();
    const overlay = page.getByRole("dialog", { name: headline });
    await expect(overlay).toBeVisible();

    // The elements are still there; only their landmark roles are gone
    await expect(overlay.locator("header")).toHaveCount(1);
    await expect(overlay.getByRole("banner")).toHaveCount(0);
    await expect(overlay.getByRole("contentinfo")).toHaveCount(0);

    // ...and what's in them keeps its own roles
    await expect(
      overlay.getByRole("heading", { level: 2, name: headline })
    ).toBeVisible();
    if (action) {
      await expect(overlay.locator("footer")).toHaveCount(1);
      await expect(
        overlay.locator("footer").getByRole("button", { name: action })
      ).toBeVisible();
    }
  });
}
