import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../tests/support/a11y-fixture";
import { expectFocusRing, resolvedColor } from "../../tests/support/helpers";

// Keyboard activation (focus + Enter) rather than a real pointer click, matching Dialog.spec.ts:
// a real click leaves the cursor hovering the element (its state layer showing) and can leave
// :focus-visible unset on whatever gains focus next.
async function activate(locator: Locator): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press("Enter");
}

test.describe("Popover", () => {
  // The demo now lives on the shared doc page at /components/popover: the Usage block
  // (#popover-usage) plus example-01 (#popover-fade-scale) and example-02
  // (#popover-close-button, which sets showCloseX). Every trigger shares the label
  // "Open Popover", so it is scoped through the CodePreview (data-testid="code-preview")
  // that also holds its popover; the source block beside each preview is highlighted
  // <pre> text.
  const previewFor = (page: Page, id: string) =>
    page.getByTestId("code-preview").filter({ has: page.locator(`#${id}`) });
  const triggerFor = (page: Page, id: string) =>
    previewFor(page, id).getByRole("button", {
      name: "Open Popover",
      exact: true,
    });

  test.beforeEach(async ({ page }) => {
    await page.goto("/components/popover");
  });

  test("opens via its trigger without moving focus off it", async ({
    page,
  }) => {
    const trigger = triggerFor(page, "popover-usage");
    await activate(trigger);

    await expect(page.locator("#popover-usage")).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("closes via its close button and returns focus to the trigger", async ({
    page,
  }) => {
    const trigger = triggerFor(page, "popover-close-button");
    await activate(trigger);

    const popover = page.locator("#popover-close-button");
    await activate(popover.getByRole("button", { name: "Close" }));

    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("closes via Escape and returns focus to the trigger", async ({
    page,
  }) => {
    const trigger = triggerFor(page, "popover-usage");
    await activate(trigger);

    const popover = page.locator("#popover-usage");
    await expect(popover).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("shows no visible motion on open/close when prefers-reduced-motion is set", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const popover = page.locator("#popover-usage");
    await expect(popover).toHaveCSS("transition-duration", "0s");

    await activate(triggerFor(page, "popover-usage"));
    await expect(popover).toBeVisible();
    await expect(popover).toHaveCSS("transition-duration", "0s");

    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(popover).toHaveCSS("transition-duration", "0s");
  });

  test("the panel and close button have M3's 1px outline-variant border", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-close-button"));

    const expectedColor = await resolvedColor(
      page,
      "var(--theme-color-outline-variant)"
    );
    const popover = page.locator("#popover-close-button");
    const panel = page.locator("#popover-close-button > div");
    const closeButton = popover.getByRole("button", { name: "Close" });

    for (const target of [panel, closeButton]) {
      await expect(target).toHaveCSS("border-top-width", "1px");
      await expect(target).toHaveCSS("border-top-color", expectedColor);
    }
  });

  test("the close button shows the focus ring, offset by the panel background", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-close-button"));

    const closeButton = page
      .locator("#popover-close-button")
      .getByRole("button", { name: "Close" });
    await closeButton.focus();

    // the panel is a BaseWrapper, which sets the ring and offset colors for its surface
    await expectFocusRing(closeButton);
  });
});
