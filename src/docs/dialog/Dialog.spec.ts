import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";
import {
  box,
  expectFocusRing,
  resolvedColor,
  settled,
  textBox,
} from "../../test/helpers";

// Activates a button via the keyboard rather than a real pointer click: a mouse click leaves the
// cursor hovering the element (its state layer showing) and can leave :focus-visible unset on
// whatever gains focus next - neither of which these tests are meant to exercise.
async function activate(locator: Locator): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press("Enter");
}

// Records the dialog's cancel/close events (with its returnValue at close) for later assertion
async function recordEvents(dialog: Locator): Promise<void> {
  await dialog.evaluate((el: HTMLDialogElement) => {
    const events: string[] = [];
    (el as HTMLDialogElement & { events: string[] }).events = events;
    el.addEventListener("cancel", () => events.push("cancel"));
    el.addEventListener("close", () => events.push(`close:${el.returnValue}`));
  });
}

const recordedEvents = (dialog: Locator) =>
  dialog.evaluate(
    (el) => (el as HTMLDialogElement & { events: string[] }).events
  );

// Every live trigger sits inside a CodePreview (data-testid="code-preview"); the source block
// beside it is highlighted <pre> text. A trigger's label can repeat between the Usage block and
// an example, so it's scoped through the preview that holds its dialog.
const trigger = (page: Page, dialogId: string, name: string) =>
  page
    .getByTestId("code-preview")
    .filter({ has: page.locator(`#${dialogId}`) })
    .getByRole("button", { name, exact: true });

test.describe("Dialog", () => {
  // /components/dialog has only the Usage block: #dialog-usage, headline "Dialog headline",
  // supporting text, and a "Close" text button in the footer slot.
  const openDialog = (page: Page) =>
    trigger(page, "dialog-usage", "Open Dialog");

  test.beforeEach(async ({ page }) => {
    await page.goto("/components/dialog");
  });

  test("opens via its trigger and moves focus inside the dialog", async ({
    page,
  }) => {
    await activate(openDialog(page));

    const dialog = page.locator("#dialog-usage");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  });

  test("closes via its close button and returns focus to the trigger", async ({
    page,
  }) => {
    const opener = openDialog(page);
    await activate(opener);

    const dialog = page.locator("#dialog-usage");
    await activate(dialog.getByRole("button", { name: "Close" }));

    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("closes via Escape and returns focus to the trigger", async ({
    page,
  }) => {
    const opener = openDialog(page);
    await activate(opener);

    const dialog = page.locator("#dialog-usage");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("shows no visible motion on open/close when prefers-reduced-motion is set", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const dialog = page.locator("#dialog-usage");
    await expect(dialog).toHaveCSS("transition-duration", "0s");

    await activate(openDialog(page));
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("transition-duration", "0s");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(dialog).toHaveCSS("transition-duration", "0s");
  });

  test("the headline names the dialog", async ({ page }) => {
    await activate(openDialog(page));

    const dialog = page.locator("#dialog-usage");
    await expect(dialog).toHaveAccessibleName("Dialog headline");
    await expect(
      dialog.getByRole("heading", { level: 2, name: "Dialog headline" })
    ).toBeVisible();
  });

  test("the container is Surface Container High, with its content 24px in from the edges", async ({
    page,
  }) => {
    await activate(openDialog(page));
    // it fades down into place, so measure it at rest
    await settled(page);

    const panel = page.locator("#dialog-usage > div");
    await expect(panel).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface-container-high)")
    );
    const panelBox = await box(panel);
    const headline = await box(page.locator("#dialog-usage h2"));
    expect(headline.x - panelBox.x).toBe(24);
    expect(headline.y - panelBox.y).toBe(24);
  });

  test("M3 spacing: 16px from the headline to the body, 24px from the body to the actions", async ({
    page,
  }) => {
    await activate(openDialog(page));
    await settled(page);

    const dialog = page.locator("#dialog-usage");
    const headline = await box(dialog.locator("h2"));
    const content = await box(page.locator("#dialog-usage-content"));
    const action = await box(dialog.getByRole("button", { name: "Close" }));
    expect(content.y - (headline.y + headline.height)).toBe(16);
    expect(action.y - (content.y + content.height)).toBe(24);
  });

  test("headline and supporting text use M3's color roles, and only the supporting text scrolls", async ({
    page,
  }) => {
    await activate(openDialog(page));

    await expect(page.locator("#dialog-usage h2")).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );
    const content = page.locator("#dialog-usage-content");
    await expect(content).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
    await expect(content).toHaveCSS("overflow-y", "auto");
  });

  test("the scrolling content shows the focus ring", async ({ page }) => {
    await activate(openDialog(page));

    // Browsers make the content focusable only once it overflows; tabindex stands in for that.
    // Focused right after a keypress, so :focus-visible applies as it would when tabbing in.
    const content = page.locator("#dialog-usage-content");
    await content.evaluate((el: HTMLElement) => {
      el.tabIndex = -1;
      el.focus();
    });

    await expectFocusRing(content, { inset: true });
  });
});

test.describe("DialogConfirm", () => {
  // Usage: #dialog-confirm-usage ("Cancel" dismisses, "Discard" confirms).
  // example-01: #dialog-yes-no ("No" dismisses, "Yes" confirms).
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/dialog-confirm");
  });

  test("is an alertdialog named by its headline and described by its content", async ({
    page,
  }) => {
    await activate(
      trigger(page, "dialog-confirm-usage", "Open Confirm Dialog")
    );

    const dialog = page.locator("#dialog-confirm-usage");
    await expect(dialog).toHaveAttribute("role", "alertdialog");
    await expect(dialog).toHaveAccessibleName("Discard draft?");
    await expect(dialog).toHaveAccessibleDescription(
      "Your unsaved changes will be lost."
    );
  });

  test("focuses the dismissing action first, placed before the confirming one", async ({
    page,
  }) => {
    await activate(
      trigger(page, "dialog-confirm-usage", "Open Confirm Dialog")
    );

    const buttons = page.locator("#dialog-confirm-usage").getByRole("button");
    await expect(buttons).toHaveText(["Cancel", "Discard"]);
    await expect(buttons.first()).toBeFocused();
  });

  test("a reflexive Enter dismisses like Escape: fires cancel and returns focus", async ({
    page,
  }) => {
    const opener = trigger(page, "dialog-confirm-usage", "Open Confirm Dialog");
    await activate(opener);

    const dialog = page.locator("#dialog-confirm-usage");
    await recordEvents(dialog);
    await page.keyboard.press("Enter");

    await expect(dialog).toBeHidden();
    expect(await recordedEvents(dialog)).toEqual(["cancel", "close:cancel"]);
    await expect(opener).toBeFocused();
  });

  test("the confirming action closes with its value, without firing cancel", async ({
    page,
  }) => {
    const opener = trigger(page, "dialog-yes-no", "Open Confirm Dialog");
    await activate(opener);

    const dialog = page.locator("#dialog-yes-no");
    await expect(dialog).toBeVisible();
    await recordEvents(dialog);

    await activate(dialog.getByRole("button", { name: "Yes", exact: true }));

    await expect(dialog).toBeHidden();
    expect(await recordedEvents(dialog)).toEqual(["close:yes"]);
    await expect(opener).toBeFocused();
  });
});

test.describe("DialogAcknowledge", () => {
  // Usage: #dialog-acknowledge-usage ("OK"). example-01: #dialog-acknowledge-icon, with the
  // "mail" icon above its headline and a "Got it" action.
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/dialog-acknowledge");
  });

  test("is an alertdialog whose single action is focused and closes it with its value", async ({
    page,
  }) => {
    const opener = trigger(
      page,
      "dialog-acknowledge-usage",
      "Open Acknowledge Dialog"
    );
    await activate(opener);

    const dialog = page.locator("#dialog-acknowledge-usage");
    await expect(dialog).toHaveAttribute("role", "alertdialog");
    await expect(dialog).toHaveAccessibleName("Draft saved");

    const action = dialog.getByRole("button");
    await expect(action).toHaveText("OK");
    await expect(action).toBeFocused();

    await recordEvents(dialog);
    await page.keyboard.press("Enter");

    await expect(dialog).toBeHidden();
    expect(await recordedEvents(dialog)).toEqual(["close:ok"]);
    await expect(opener).toBeFocused();
  });

  test("with an icon, the icon and headline are centered, 16px apart, and the icon is decorative", async ({
    page,
  }) => {
    await activate(
      trigger(page, "dialog-acknowledge-icon", "Open Notification Dialog")
    );
    // it fades down into place, so measure it at rest
    await settled(page);

    const dialog = page.locator("#dialog-acknowledge-icon");
    const center = ({ x, width }: { x: number; width: number }) =>
      x + width / 2;
    const panel = await box(dialog.locator("> div"));
    const icon = dialog.locator("header svg");
    const iconBox = await box(icon);
    const headline = await textBox(dialog.locator("h2"));

    expect(center(iconBox)).toBeCloseTo(center(panel), 0);
    expect(center(headline)).toBeCloseTo(center(panel), 0);
    expect(iconBox.width).toBe(24);
    expect(
      (await box(dialog.locator("h2"))).y - (iconBox.y + iconBox.height)
    ).toBe(16);

    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon).toHaveCSS(
      "fill",
      await resolvedColor(page, "var(--theme-color-secondary)")
    );
    await expect(dialog).toHaveAccessibleName("Message sent");
  });
});
