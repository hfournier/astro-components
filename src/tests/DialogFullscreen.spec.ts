import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor, settled } from "./support/helpers";

// Each case on /tests/dialog-fullscreen is a Section with data-testid="dialog-fullscreen-<caseId>"
// holding an "Open full-screen dialog" button and the dialog it opens:
// - basic: "New event", closed with "Cancel", confirmed with "Save" (value "save", id
//   "basic-save"), and a Title text field
// - scrolling: "Terms of service", content taller than the window, confirmed with "Accept", and a
//   "Print" button in its actions slot
type DialogFullscreenCaseId = "basic" | "scrolling";

// M3 window size classes: compact below 600px, medium from 600px
const COMPACT = { width: 400, height: 800 };
const MEDIUM = { width: 800, height: 800 };

const dialogCase = (page: Page, caseId: DialogFullscreenCaseId) =>
  page.getByTestId(`dialog-fullscreen-${caseId}`);
const dialogIn = (page: Page, caseId: DialogFullscreenCaseId) =>
  dialogCase(page, caseId).locator("dialog");
// The panel: the dialog's visible container
const panelOf = (dialog: Locator) => dialog.locator("> div");
const headerOf = (dialog: Locator) => dialog.locator("header");
const footerOf = (dialog: Locator) => dialog.locator("footer");

// Activates via the keyboard, as in Dialog.spec.ts: a mouse click leaves the pointer hovering
async function open(page: Page, caseId: DialogFullscreenCaseId) {
  const opener = dialogCase(page, caseId).getByRole("button", {
    name: "Open full-screen dialog",
  });
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(dialogIn(page, caseId)).toBeVisible();
  await settled(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/dialog-fullscreen");
});

test.describe("DialogFullscreen in a compact window", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(COMPACT);
  });

  test("fills the window on surface, with square corners and a 56px header", async ({
    page,
  }) => {
    await open(page, "basic");
    const dialog = dialogIn(page, "basic");

    expect(await box(panelOf(dialog))).toEqual({
      x: 0,
      y: 0,
      ...COMPACT,
    });
    await expect(panelOf(dialog)).toHaveCSS("border-radius", "0px");
    await expect(panelOf(dialog)).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface)")
    );
    expect((await box(headerOf(dialog))).height).toBe(56);
    await expect(headerOf(dialog)).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface)")
    );
    // the headline is M3 Title Large, on-surface
    const headline = dialog.getByRole("heading", { name: "New event" });
    await expect(headline).toHaveCSS("font-size", "22px");
    await expect(headline).toHaveCSS("line-height", "28px");
    await expect(headline).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );
  });

  test("its actions slot is a 56px bottom action bar, pinned to the bottom of the window", async ({
    page,
  }) => {
    await open(page, "scrolling");
    const dialog = dialogIn(page, "scrolling");
    const bar = await box(footerOf(dialog));

    expect(bar.height).toBe(56);
    expect(bar.y + bar.height).toBe(COMPACT.height);
    await expect(dialog.getByRole("button", { name: "Print" })).toBeVisible();
    // the dismiss and confirm copies are the header's
    await expect(
      footerOf(dialog).getByRole("button", { name: "Accept" })
    ).toHaveCount(0);
  });

  test("without an actions slot, there's no bottom action bar", async ({
    page,
  }) => {
    await open(page, "basic");

    await expect(footerOf(dialogIn(page, "basic"))).toBeHidden();
  });

  test("the header turns Surface Container at elevation 2 once content scrolls under it", async ({
    page,
    browserName,
  }) => {
    // scroll-state container queries are Chromium only for now
    test.skip(browserName !== "chromium", "no scroll-state queries");
    await open(page, "scrolling");
    const dialog = dialogIn(page, "scrolling");
    const header = headerOf(dialog);
    await expect(header).toHaveCSS("box-shadow", "none");

    await panelOf(dialog).evaluate((el) => el.scrollBy(0, 200));
    await expect(header).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface-container)")
    );
    await expect(header).not.toHaveCSS("box-shadow", "none");
  });

  test("the close button fires a cancelable cancel, so the page can ask first", async ({
    page,
  }) => {
    await open(page, "basic");
    const dialog = dialogIn(page, "basic");
    // the page keeps it open on the first try, e.g. to ask whether to discard changes
    await dialog.evaluate((el) =>
      el.addEventListener("cancel", (event) => event.preventDefault(), {
        once: true,
      })
    );
    const close = dialog.getByRole("button", { name: "Cancel" });

    await close.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    expect(
      await dialog.evaluate((el) => (el as HTMLDialogElement).returnValue)
    ).toBe("");
  });

  test("Escape after an earlier Save closes with an empty returnValue", async ({
    page,
  }) => {
    const dialog = dialogIn(page, "basic");
    await open(page, "basic");
    await dialog.getByRole("button", { name: "Save" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    expect(
      await dialog.evaluate((el) => (el as HTMLDialogElement).returnValue)
    ).toBe("save");

    await open(page, "basic");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(
      await dialog.evaluate((el) => (el as HTMLDialogElement).returnValue)
    ).toBe("");
  });

  test("the close icon is M3's 24px, in on-surface", async ({ page }) => {
    await open(page, "basic");
    const close = dialogIn(page, "basic").getByRole("button", {
      name: "Cancel",
    });
    const icon = close.locator("svg").first();

    expect(await box(icon)).toMatchObject({ width: 24, height: 24 });
    await expect(close).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );
  });

  test("focus lands on the close button, the first interactive element", async ({
    page,
  }) => {
    await open(page, "basic");

    await expect(
      dialogIn(page, "basic").getByRole("button", { name: "Cancel" })
    ).toBeFocused();
  });
});

test.describe("DialogFullscreen from a medium window up", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MEDIUM);
  });

  test("is a basic dialog: Surface Container High, 28px corners, 280-560px wide, centered over the scrim", async ({
    page,
  }) => {
    await open(page, "basic");
    const dialog = dialogIn(page, "basic");
    const panel = panelOf(dialog);

    await expect(panel).toHaveCSS("border-radius", "28px");
    await expect(panel).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface-container-high)")
    );
    const { x, y, width, height } = await box(panel);
    expect(width).toBeGreaterThanOrEqual(280);
    expect(width).toBeLessThanOrEqual(560);
    expect(x).toBeCloseTo(MEDIUM.width - (x + width), 0);
    expect(y).toBeCloseTo(MEDIUM.height - (y + height), 0);
    expect(
      await dialog.evaluate(
        (el) => getComputedStyle(el, "::backdrop").backgroundColor
      )
    ).toBe(
      await resolvedColor(
        page,
        "color-mix(in oklab, var(--theme-color-scrim) 32%, transparent)"
      )
    );
    // the headline is M3 Headline Small, 24px in from the corner
    const headline = dialog.getByRole("heading", { name: "New event" });
    await expect(headline).toHaveCSS("font-size", "24px");
    await expect(headline).toHaveCSS("line-height", "32px");
    const headlineBox = await box(headline);
    expect(headlineBox.x - x).toBe(24);
    expect(headlineBox.y - y).toBe(24);
  });

  test("has no close icon: Cancel, then Save, at the end of the action row", async ({
    page,
  }) => {
    await open(page, "basic");
    const dialog = dialogIn(page, "basic");
    const panel = await box(panelOf(dialog));
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    const save = dialog.getByRole("button", { name: "Save" });

    await expect(cancel).toHaveText("Cancel");
    const cancelBox = await box(cancel);
    const saveBox = await box(save);
    expect(saveBox.y).toBe(cancelBox.y);
    expect(saveBox.x).toBeGreaterThan(cancelBox.x);
    expect(panel.x + panel.width - (saveBox.x + saveBox.width)).toBeCloseTo(
      24,
      0
    );
    expect(panel.y + panel.height - (saveBox.y + saveBox.height)).toBeCloseTo(
      24,
      0
    );
    // the action row's copy carries buttonConfirm's id
    await expect(save).toHaveAttribute("id", "basic-save");
  });

  test("a click on the scrim cancels it, as Dialog", async ({ page }) => {
    await open(page, "basic");
    const dialog = dialogIn(page, "basic");

    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });
});

test.describe("DialogFullscreen at every width", () => {
  // The focused button's text, or "input" for the text field
  const focusedLabel = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return el.tagName === "INPUT" ? "input" : el.textContent!.trim();
    });

  const cases = [
    // compact: close and confirm in the header, then the content
    { window: COMPACT, order: ["Cancel", "Save", "input"] },
    // medium: the content first, then dismiss and confirm in the action row
    { window: MEDIUM, order: ["input", "Cancel", "Save"] },
  ];

  for (const { window, order } of cases) {
    test(`at ${window.width}px, one Cancel and one Save, in visual order: ${order.join(", ")}`, async ({
      page,
    }) => {
      await page.setViewportSize(window);
      await open(page, "basic");
      const dialog = dialogIn(page, "basic");

      await expect(dialog.getByRole("button", { name: "Cancel" })).toHaveCount(
        1
      );
      await expect(dialog.getByRole("button", { name: "Save" })).toHaveCount(1);
      // focus starts on the first; Tab goes through the rest
      const visited = [await focusedLabel(page)];
      for (let i = 1; i < order.length; i++) {
        await page.keyboard.press("Tab");
        visited.push(await focusedLabel(page));
      }
      expect(visited).toEqual(order);
    });
  }

  test("resized across medium while open, it keeps its content and form values", async ({
    page,
  }) => {
    await page.setViewportSize(COMPACT);
    await open(page, "basic");
    const dialog = dialogIn(page, "basic");
    const title = dialog.getByRole("textbox", { name: "Title" });
    await title.fill("Team lunch");

    await page.setViewportSize(MEDIUM);
    await expect(dialog).toBeVisible();
    await expect(panelOf(dialog)).toHaveCSS("border-radius", "28px");
    await expect(title).toHaveValue("Team lunch");

    await page.setViewportSize(COMPACT);
    await expect(panelOf(dialog)).toHaveCSS("border-radius", "0px");
    await expect(title).toHaveValue("Team lunch");
    await expect(title).toBeFocused();
  });
});
