import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

async function resolvedStyle(
  page: Page,
  property: string,
  cssValue: string
): Promise<string> {
  return page.evaluate(
    ({ property, cssValue }) => {
      const probe = document.createElement("div");
      probe.style.setProperty(property, cssValue);
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).getPropertyValue(property);
      probe.remove();
      return resolved;
    },
    { property, cssValue }
  );
}

// Keyboard activation (focus + Enter) rather than a real pointer click, matching Dialog.spec.ts:
// a real click leaves the cursor hovering the element, which flips it into Button's (currently
// contrast-failing) :hover style - not something this retrofit's tests should exercise.
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

  test("wrapper rounding resolves to the container radius token, flat at every width", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-usage"));

    const expectedRadius = await resolvedStyle(
      page,
      "border-radius",
      "var(--radius-container)"
    );

    const wrapper = page.locator("#popover-usage > div");
    for (const width of [400, 900, 1400]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(wrapper).toHaveCSS("border-top-left-radius", expectedRadius);
    }
  });

  test("close button keeps rounded-full regardless of the container radius token", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-close-button"));

    const closeButton = page
      .locator("#popover-close-button")
      .getByRole("button", { name: "Close" });
    const radius = await closeButton.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopLeftRadius)
    );
    // rounded-full resolves to an effectively-infinite radius (browsers differ on the exact huge
    // number), well past --radius-container - it just needs to stay a pill, not the container radius.
    expect(radius).toBeGreaterThan(1000);
  });

  test("close button's edge resolves to the divider border-width token", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-close-button"));

    const expectedWidth = await resolvedStyle(
      page,
      "border-top-width",
      "var(--border-width-divider)"
    );
    const closeButton = page
      .locator("#popover-close-button")
      .getByRole("button", { name: "Close" });
    await expect(closeButton).toHaveCSS("border-top-width", expectedWidth);
  });

  test("close button focus ring resolves to the dedicated focus-ring tokens", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-close-button"));

    const expectedColor = await resolvedStyle(
      page,
      "outline-color",
      "var(--color-focus-ring)"
    );
    const expectedWidth = await resolvedStyle(
      page,
      "outline-width",
      "var(--focus-ring-width)"
    );
    const expectedOffset = await resolvedStyle(
      page,
      "outline-offset",
      "var(--focus-ring-offset)"
    );

    const closeButton = page
      .locator("#popover-close-button")
      .getByRole("button", { name: "Close" });
    await closeButton.focus();
    await expect(closeButton).toHaveCSS("outline-color", expectedColor);
    await expect(closeButton).toHaveCSS("outline-width", expectedWidth);
    await expect(closeButton).toHaveCSS("outline-offset", expectedOffset);
  });
});
