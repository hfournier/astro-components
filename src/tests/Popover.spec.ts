import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { expectFocusRing, resolvedColor } from "./support/helpers";

// Keyboard activation (focus + Enter) rather than a real pointer click, matching Dialog.spec.ts:
// a real click leaves the cursor hovering the element (its state layer showing) and can leave
// :focus-visible unset on whatever gains focus next.
async function activate(locator: Locator): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press("Enter");
}

// Each case on /tests/popover is a Section with data-testid="popover-<caseId>" holding one trigger
// and the Popover it opens. The basic case's Popover has only its id; the close-button case's sets
// showCloseX and the fade-scale transition. Each trigger's label names its case.
type PopoverCaseId = "basic" | "close-button";

const TRIGGER_LABELS: Record<PopoverCaseId, string> = {
  basic: "Open basic Popover",
  "close-button": "Open Popover with close button",
};

const popoverCase = (page: Page, caseId: PopoverCaseId) =>
  page.getByTestId(`popover-${caseId}`);
const popoverFor = (page: Page, caseId: PopoverCaseId) =>
  popoverCase(page, caseId).locator("[popover]");
const triggerFor = (page: Page, caseId: PopoverCaseId) =>
  popoverCase(page, caseId).getByRole("button", {
    name: TRIGGER_LABELS[caseId],
    exact: true,
  });

test.describe("Popover", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/popover");
  });

  test("opens via its trigger without moving focus off it", async ({
    page,
  }) => {
    const trigger = triggerFor(page, "basic");
    await activate(trigger);

    await expect(popoverFor(page, "basic")).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("closes via its close button and returns focus to the trigger", async ({
    page,
  }) => {
    const trigger = triggerFor(page, "close-button");
    await activate(trigger);

    const popover = popoverFor(page, "close-button");
    await activate(popover.getByRole("button", { name: "Close" }));

    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("closes via Escape and returns focus to the trigger", async ({
    page,
  }) => {
    const trigger = triggerFor(page, "basic");
    await activate(trigger);

    const popover = popoverFor(page, "basic");
    await expect(popover).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("shows no visible motion on open/close when prefers-reduced-motion is set", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const popover = popoverFor(page, "basic");
    await expect(popover).toHaveCSS("transition-duration", "0s");

    await activate(triggerFor(page, "basic"));
    await expect(popover).toBeVisible();
    await expect(popover).toHaveCSS("transition-duration", "0s");

    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(popover).toHaveCSS("transition-duration", "0s");
  });

  test("the panel and close button have M3's 1px outline-variant border", async ({
    page,
  }) => {
    await activate(triggerFor(page, "close-button"));

    const expectedColor = await resolvedColor(
      page,
      "var(--theme-color-outline-variant)"
    );
    const popover = popoverFor(page, "close-button");
    const panel = popover.locator("> div");
    const closeButton = popover.getByRole("button", { name: "Close" });

    for (const target of [panel, closeButton]) {
      await expect(target).toHaveCSS("border-top-width", "1px");
      await expect(target).toHaveCSS("border-top-color", expectedColor);
    }
  });

  test("the close button shows the focus ring, offset by the panel background", async ({
    page,
  }) => {
    await activate(triggerFor(page, "close-button"));

    const closeButton = popoverFor(page, "close-button").getByRole("button", {
      name: "Close",
    });
    await closeButton.focus();

    // the panel is a BaseWrapper, which sets the ring and offset colors for its surface
    await expectFocusRing(closeButton);
  });
});
