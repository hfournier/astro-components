import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  expectFocusRing,
  resolvedColor,
  settled,
  textBox,
} from "./support/helpers";

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

// Each case on /tests/dialog is a Section with data-testid="dialog-<caseId>" holding one trigger
// button and the dialog it opens. Trigger labels repeat between cases ("Open Confirm Dialog"),
// so both are found within their case.
type DialogCaseId =
  | "basic"
  | "confirm"
  | "confirm-yes-no"
  | "acknowledge"
  | "acknowledge-icon"
  | "scrolling"
  | "stacked";

const dialogCase = (page: Page, caseId: DialogCaseId) =>
  page.getByTestId(`dialog-${caseId}`);
const trigger = (page: Page, caseId: DialogCaseId, name: string) =>
  dialogCase(page, caseId).getByRole("button", { name, exact: true });
const dialogIn = (page: Page, caseId: DialogCaseId) =>
  dialogCase(page, caseId).locator("dialog");

// DialogConfirm and DialogAcknowledge are built on Dialog and share its test page
test.beforeEach(async ({ page }) => {
  await page.goto("/tests/dialog");
});

test.describe("Dialog", () => {
  // The basic case: headline "Dialog headline", supporting text (#basic-dialog-content), and a
  // "Close" text button in the actions slot.
  const openDialog = (page: Page) => trigger(page, "basic", "Open Dialog");
  const basicDialog = (page: Page) => dialogIn(page, "basic");
  const supportingText = (page: Page) =>
    basicDialog(page).locator("#basic-dialog-content");

  test("opens via its trigger and moves focus inside the dialog", async ({
    page,
  }) => {
    await activate(openDialog(page));

    const dialog = basicDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  });

  test("closes via its close button and returns focus to the trigger", async ({
    page,
  }) => {
    const opener = openDialog(page);
    await activate(opener);

    const dialog = basicDialog(page);
    await activate(dialog.getByRole("button", { name: "Close" }));

    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("closes via Escape and returns focus to the trigger", async ({
    page,
  }) => {
    const opener = openDialog(page);
    await activate(opener);

    const dialog = basicDialog(page);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("shows no visible motion on open/close when prefers-reduced-motion is set", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const dialog = basicDialog(page);
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

    const dialog = basicDialog(page);
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

    const panel = basicDialog(page).locator("> div");
    await expect(panel).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface-container-high)")
    );
    const panelBox = await box(panel);
    const headline = await box(basicDialog(page).locator("h2"));
    expect(headline.x - panelBox.x).toBe(24);
    expect(headline.y - panelBox.y).toBe(24);
  });

  test("M3 spacing: 16px from the headline to the body, 24px from the body to the actions", async ({
    page,
  }) => {
    await activate(openDialog(page));
    await settled(page);

    const dialog = basicDialog(page);
    const headline = await box(dialog.locator("h2"));
    const content = await box(supportingText(page));
    const action = await box(dialog.getByRole("button", { name: "Close" }));
    expect(content.y - (headline.y + headline.height)).toBe(16);
    expect(action.y - (content.y + content.height)).toBe(24);
  });

  test("M3's scrim: the scrim color at 32%, not blurred", async ({ page }) => {
    await activate(openDialog(page));
    await settled(page);

    const backdrop = (property: string) =>
      basicDialog(page).evaluate(
        (el, p) => getComputedStyle(el, "::backdrop").getPropertyValue(p),
        property
      );
    expect(await backdrop("backdrop-filter")).toBe("none");
    expect(await backdrop("background-color")).toBe(
      await resolvedColor(
        page,
        "color-mix(in oklab, var(--theme-color-scrim) 32%, transparent)"
      )
    );
  });

  // M3 (md-dialog) cancels a dialog on a scrim click, the same as Escape. The dialog is centred,
  // so the viewport's corner is on the scrim.
  test("a click on the scrim cancels it, with an empty returnValue, and returns focus", async ({
    page,
  }) => {
    const opener = openDialog(page);
    await activate(opener);
    const dialog = basicDialog(page);
    await settled(page);
    await recordEvents(dialog);

    await page.mouse.click(5, 5);

    await expect(dialog).toBeHidden();
    expect(await recordedEvents(dialog)).toEqual(["cancel", "close:"]);
    await expect(opener).toBeFocused();
  });

  test("stays open on a scrim click when the page prevents cancel", async ({
    page,
  }) => {
    await activate(openDialog(page));
    const dialog = basicDialog(page);
    await settled(page);
    await dialog.evaluate((el) =>
      el.addEventListener("cancel", (event) => event.preventDefault())
    );

    await page.mouse.click(5, 5);

    await expect(dialog).toBeVisible();
  });

  test("stays open when a press starts in the content and ends on the scrim", async ({
    page,
  }) => {
    await activate(openDialog(page));
    const dialog = basicDialog(page);
    await settled(page);

    const { x, y } = await box(supportingText(page));
    await page.mouse.move(x + 2, y + 2);
    await page.mouse.down();
    await page.mouse.move(5, 5, { steps: 5 });
    await page.mouse.up();

    await expect(dialog).toBeVisible();
  });

  test("lays out a bare Button in its actions slot end-aligned, in a <footer>", async ({
    page,
  }) => {
    await activate(openDialog(page));
    await settled(page);

    const dialog = basicDialog(page);
    const panel = await box(dialog.locator("> div"));
    const close = dialog
      .locator("footer")
      .getByRole("button", { name: "Close" });
    const action = await box(close);
    expect(panel.x + panel.width - (action.x + action.width)).toBe(24);
  });

  test("headline and supporting text use M3's color roles, and only the supporting text scrolls", async ({
    page,
  }) => {
    await activate(openDialog(page));

    await expect(basicDialog(page).locator("h2")).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );
    const content = supportingText(page);
    await expect(content).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
    await expect(content).toHaveCSS("overflow-y", "auto");
  });

  test("M3 supporting text: Body Medium, 14/20 with 0.25px tracking", async ({
    page,
  }) => {
    await activate(openDialog(page));

    const content = supportingText(page);
    await expect(content).toHaveCSS("font-size", "14px");
    await expect(content).toHaveCSS("line-height", "20px");
    await expect(content).toHaveCSS("letter-spacing", "0.25px");
  });

  test("content scrolled out of view below shows an outline-colored divider", async ({
    page,
    browserName,
  }) => {
    // scroll-state container queries, which show the divider, are Chromium only for now
    test.skip(browserName !== "chromium", "no scroll-state queries");
    await activate(trigger(page, "scrolling", "Open Dialog"));
    await settled(page);

    const bottomDivider = dialogIn(page, "scrolling").locator(
      "#scrolling-dialog-content > [aria-hidden]:last-child"
    );
    await expect(bottomDivider).toHaveCSS("opacity", "1");
    await expect(bottomDivider).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-outline)")
    );
  });

  test("the scrolling content shows the focus ring", async ({ page }) => {
    await activate(openDialog(page));

    // Browsers make the content focusable only once it overflows; tabindex stands in for that.
    // Focused right after a keypress, so :focus-visible applies as it would when tabbing in.
    const content = supportingText(page);
    await content.evaluate((el: HTMLElement) => {
      el.tabIndex = -1;
      el.focus();
    });

    await expectFocusRing(content, { inset: true });
  });
});

test.describe("DialogConfirm", () => {
  // The confirm case: "Cancel" dismisses, "Discard" confirms.
  // The confirm-yes-no case: "No" dismisses, "Yes" confirms.
  // The stacked case: 280px wide, "Keep editing the draft" dismisses, "Discard all changes"
  // confirms.

  test("actions too long for one row stack, confirm above dismiss, both at the end", async ({
    page,
  }) => {
    await activate(trigger(page, "stacked", "Open Confirm Dialog"));
    await settled(page);

    const dialog = dialogIn(page, "stacked");
    const panel = await box(dialog.locator("> div"));
    const dismiss = dialog.getByRole("button", {
      name: "Keep editing the draft",
    });
    const confirm = dialog.getByRole("button", { name: "Discard all changes" });
    const dismissBox = await box(dismiss);
    const confirmBox = await box(confirm);

    expect(panel.width).toBe(280);
    expect(confirmBox.y + confirmBox.height).toBeLessThanOrEqual(dismissBox.y);
    // both end at the panel's 24px padding, and nothing overflows it
    for (const action of [dismissBox, confirmBox]) {
      expect(panel.x + panel.width - (action.x + action.width)).toBeCloseTo(
        24,
        0
      );
      expect(action.x).toBeGreaterThanOrEqual(panel.x + 24);
    }
    // the Tab order still follows the DOM: dismiss, then confirm
    await expect(dismiss).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
  });
  test("is an alertdialog named by its headline and described by its content", async ({
    page,
  }) => {
    await activate(trigger(page, "confirm", "Open Confirm Dialog"));

    const dialog = dialogIn(page, "confirm");
    await expect(dialog).toHaveAttribute("role", "alertdialog");
    await expect(dialog).toHaveAccessibleName("Discard draft?");
    await expect(dialog).toHaveAccessibleDescription(
      "Your unsaved changes will be lost."
    );
  });

  test("focuses the dismissing action first, placed before the confirming one", async ({
    page,
  }) => {
    await activate(trigger(page, "confirm", "Open Confirm Dialog"));

    const buttons = dialogIn(page, "confirm").getByRole("button");
    await expect(buttons).toHaveText(["Cancel", "Discard"]);
    await expect(buttons.first()).toBeFocused();
  });

  test("puts its actions in one row, 8px apart, not in a list", async ({
    page,
  }) => {
    await activate(trigger(page, "confirm", "Open Confirm Dialog"));
    await settled(page);

    const dialog = dialogIn(page, "confirm");
    const dismiss = await box(dialog.getByRole("button", { name: "Cancel" }));
    const confirm = await box(dialog.getByRole("button", { name: "Discard" }));
    expect(confirm.y).toBe(dismiss.y);
    expect(confirm.x - (dismiss.x + dismiss.width)).toBe(8);
    await expect(dialog.getByRole("list")).toHaveCount(0);
  });

  test("a reflexive Enter dismisses like Escape: fires cancel and returns focus", async ({
    page,
  }) => {
    const opener = trigger(page, "confirm", "Open Confirm Dialog");
    await activate(opener);

    const dialog = dialogIn(page, "confirm");
    await recordEvents(dialog);
    await page.keyboard.press("Enter");

    await expect(dialog).toBeHidden();
    expect(await recordedEvents(dialog)).toEqual(["cancel", "close:cancel"]);
    await expect(opener).toBeFocused();
  });

  test("the confirming action closes with its value, without firing cancel", async ({
    page,
  }) => {
    const opener = trigger(page, "confirm-yes-no", "Open Confirm Dialog");
    await activate(opener);

    const dialog = dialogIn(page, "confirm-yes-no");
    await expect(dialog).toBeVisible();
    await recordEvents(dialog);

    await activate(dialog.getByRole("button", { name: "Yes", exact: true }));

    await expect(dialog).toBeHidden();
    expect(await recordedEvents(dialog)).toEqual(["close:yes"]);
    await expect(opener).toBeFocused();
  });

  // Browsers don't all clear returnValue on reopening, so an Escape could report the last
  // opening's action
  test("Escape after an earlier confirm closes with an empty returnValue", async ({
    page,
  }) => {
    const opener = trigger(page, "confirm-yes-no", "Open Confirm Dialog");
    const dialog = dialogIn(page, "confirm-yes-no");
    await activate(opener);
    await activate(dialog.getByRole("button", { name: "Yes", exact: true }));
    await expect(dialog).toBeHidden();

    await activate(opener);
    await expect(dialog).toBeVisible();
    await recordEvents(dialog);
    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    expect(await recordedEvents(dialog)).toEqual(["cancel", "close:"]);
  });

  test("a click on the scrim cancels it like Escape, not like either action", async ({
    page,
  }) => {
    await activate(trigger(page, "confirm", "Open Confirm Dialog"));
    const dialog = dialogIn(page, "confirm");
    await settled(page);
    await recordEvents(dialog);

    await page.mouse.click(5, 5);

    await expect(dialog).toBeHidden();
    expect(await recordedEvents(dialog)).toEqual(["cancel", "close:"]);
  });
});

test.describe("DialogAcknowledge", () => {
  // The acknowledge case has an "OK" action. The acknowledge-icon case has the "mail" icon above
  // its headline and a "Got it" action.
  test("is an alertdialog whose single action is focused and closes it with its value", async ({
    page,
  }) => {
    const opener = trigger(page, "acknowledge", "Open Acknowledge Dialog");
    await activate(opener);

    const dialog = dialogIn(page, "acknowledge");
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
      trigger(page, "acknowledge-icon", "Open Notification Dialog")
    );
    // it fades down into place, so measure it at rest
    await settled(page);

    const dialog = dialogIn(page, "acknowledge-icon");
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
