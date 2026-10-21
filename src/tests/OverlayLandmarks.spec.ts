import { test, expect } from "./support/a11y-fixture";

// A modal Dialog and SheetSide render their headline row in a <header>, and SheetBottom its drag
// handle (and Dialog and SheetSide their actions in a <footer>). Outside <main> and any sectioning
// element, a bare <header> or <footer> is a banner or contentinfo landmark, which an overlay's top
// row and buttons aren't. /tests/overlay-landmarks places one of each outside <main>. name is the
// overlay's accessible name, inHeader what its header holds, and footerAction the button in its
// footer, for those that have one.
type Overlay = {
  component: string;
  trigger: string;
  name: string;
  inHeader: { role: "heading" | "button"; name: string };
  footerAction?: string;
};
const overlays: Overlay[] = [
  {
    component: "Dialog",
    trigger: "Open dialog",
    name: "Dialog headline",
    inHeader: { role: "heading", name: "Dialog headline" },
    footerAction: "Done",
  },
  {
    component: "SheetSide",
    trigger: "Open side sheet",
    name: "Side sheet headline",
    inHeader: { role: "heading", name: "Side sheet headline" },
    footerAction: "Save",
  },
  {
    component: "SheetBottom",
    trigger: "Open bottom sheet",
    name: "Bottom sheet",
    // its drag handle, which closes it, as its content fits in one height
    inHeader: { role: "button", name: "Close" },
  },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/overlay-landmarks");
});

for (const { component, trigger, name, inHeader, footerAction } of overlays) {
  test(`an open modal ${component} outside <main> adds no banner or contentinfo landmark`, async ({
    page,
  }) => {
    await page.getByRole("button", { name: trigger }).click();
    const overlay = page.getByRole("dialog", { name });
    await expect(overlay).toBeVisible();

    // The elements are still there; only their landmark roles are gone
    await expect(overlay.locator("header")).toHaveCount(1);
    await expect(overlay.getByRole("banner")).toHaveCount(0);
    await expect(overlay.getByRole("contentinfo")).toHaveCount(0);

    // ...and what's in them keeps its own roles
    await expect(
      overlay
        .locator("header")
        .getByRole(inHeader.role, { name: inHeader.name, exact: true })
    ).toBeVisible();
    if (footerAction) {
      const footer = overlay.locator("footer");
      await expect(footer).toHaveCount(1);
      await expect(
        footer.getByRole("button", { name: footerAction })
      ).toBeVisible();
    }
  });
}
