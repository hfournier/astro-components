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

  test("panel uses M3's 12px medium corner, flat at every width", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-usage"));

    const wrapper = page.locator("#popover-usage > div");
    for (const width of [400, 900, 1400]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(wrapper).toHaveCSS("border-top-left-radius", "12px");
    }
  });

  test("close button stays fully rounded, not the panel's corner radius", async ({
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
    // number), well past the panel's 12px - it just needs to stay a pill.
    expect(radius).toBeGreaterThan(1000);
  });

  test("the panel and close button have M3's 1px outline-variant border", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-close-button"));

    const expectedColor = await resolvedStyle(
      page,
      "border-top-color",
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

  test("close button focus ring is a 3px ring in the focus-ring-on-bg color, offset by the panel background", async ({
    page,
  }) => {
    await activate(triggerFor(page, "popover-close-button"));

    const closeButton = page
      .locator("#popover-close-button")
      .getByRole("button", { name: "Close" });

    // Resolved inside the popover: its panel is a BaseWrapper, which sets both for its surface
    const [ringColor, offsetColor] = await closeButton.evaluate((el) =>
      ["--theme-color-focus-ring-on-bg", "--theme-color-wrapper-bg"].map(
        (token) => {
          const probe = document.createElement("div");
          probe.style.color = `var(${token})`;
          el.parentElement!.appendChild(probe);
          const resolved = getComputedStyle(probe).color;
          probe.remove();
          return resolved;
        }
      )
    );

    await closeButton.focus();
    // Tailwind draws ring-offset-2 + ring-3 as two box-shadows: a 2px spread in the background
    // color, then the ring color out to 5px
    await expect
      .poll(() => closeButton.evaluate((el) => getComputedStyle(el).boxShadow))
      .toContain(
        `${offsetColor} 0px 0px 0px 2px, ${ringColor} 0px 0px 0px 5px`
      );
  });
});
