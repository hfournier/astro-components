import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

async function resolvedColor(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.color = value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssValue);
}

const box = async (locator: Locator) => {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error("element has no bounding box");
  return rect;
};

// Each live Badge sits in its own CodePreview (data-testid="code-preview") beside the Icon it's
// anchored to, and is the only aria-hidden <span> there. Previews are told apart by the
// anchor Icon's accessible name: usage "Inbox, 3 unread" (label 3), example-01
// "Notifications, new activity" (no label, a dot), example-02 "Messages, 1500 unread" (label 1500).
const preview = (page: Page, iconName: string) =>
  page
    .getByTestId("code-preview")
    .filter({ has: page.locator(`svg[aria-label="${iconName}"]`) });
const anchor = (page: Page, iconName: string) =>
  preview(page, iconName).locator(`svg[aria-label="${iconName}"]`);
const badge = (page: Page, iconName: string) =>
  preview(page, iconName).locator('span[aria-hidden="true"]').first();

test.describe("Badge", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/badge");
  });

  test("shows its count on the error role and is hidden from assistive tech", async ({
    page,
  }) => {
    const target = badge(page, "Inbox, 3 unread");

    await expect(target).toHaveText("3");
    await expect(target).toHaveAttribute("aria-hidden", "true");
    await expect(target).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-error)")
    );
    await expect(target).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-error)")
    );
    await expect(target).toHaveCSS("height", "16px");
  });

  test("the anchor icon carries the count in the button's accessible name", async ({
    page,
  }) => {
    await expect(
      preview(page, "Inbox, 3 unread").getByRole("button")
    ).toHaveAccessibleName("Inbox, 3 unread");
  });

  test("a badge with a count overlaps its anchor's top-end corner, per M3's offsets", async ({
    page,
  }) => {
    const icon = await box(anchor(page, "Inbox, 3 unread"));
    const target = await box(badge(page, "Inbox, 3 unread"));

    expect(target.x).toBeCloseTo(icon.x + icon.width - 12, 0);
    expect(target.y).toBeCloseTo(icon.y - 2, 0);
  });

  test("without a label it is a 6px dot on its anchor's top-end corner", async ({
    page,
  }) => {
    const iconName = "Notifications, new activity";
    const target = badge(page, iconName);

    await expect(target).toHaveText("");
    await expect(target).toHaveCSS("width", "6px");
    await expect(target).toHaveCSS("height", "6px");

    const icon = await box(anchor(page, iconName));
    const dot = await box(target);
    expect(dot.x + dot.width).toBeCloseTo(icon.x + icon.width, 0);
    expect(dot.y).toBeCloseTo(icon.y, 0);
  });

  test("caps a count over 999 at 999+", async ({ page }) => {
    await expect(badge(page, "Messages, 1500 unread")).toHaveText("999+");
  });
});
