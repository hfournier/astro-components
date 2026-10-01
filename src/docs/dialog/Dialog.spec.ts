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
  });

  test("the headline names the dialog", async ({ page }) => {
    await activate(openDialog(page));

    const dialog = page.locator("#dialog-usage");
    await expect(dialog).toHaveAccessibleName("Dialog headline");
    await expect(
      dialog.getByRole("heading", { level: 2, name: "Dialog headline" })
    ).toBeVisible();
  });

  test("container matches M3: 28px corners, 24px padding, Surface Container High", async ({
    page,
  }) => {
    await activate(openDialog(page));

    const panel = page.locator("#dialog-usage > div");
    await expect(panel).toHaveCSS("border-top-left-radius", "28px");
    await expect(panel).toHaveCSS("padding-top", "24px");
    await expect(panel).toHaveCSS("padding-left", "24px");
    await expect(panel).toHaveCSS("min-width", "280px");
    await expect(panel).toHaveCSS("max-width", "560px");
    await expect(panel).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface-container-high)")
    );
  });

  test("headline and supporting text use M3's type styles and colors", async ({
    page,
  }) => {
    await activate(openDialog(page));

    // Headline Small
    const headline = page.locator("#dialog-usage h2");
    await expect(headline).toHaveCSS("font-size", "24px");
    await expect(headline).toHaveCSS("line-height", "32px");
    await expect(headline).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );

    // Body Medium, and the only part that scrolls
    const content = page.locator("#dialog-usage-content");
    await expect(content).toHaveCSS("font-size", "14px");
    await expect(content).toHaveCSS("line-height", "20px");
    await expect(content).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
    await expect(content).toHaveCSS("overflow-y", "auto");
  });

  test("the scrolling content's focus ring is a 3px inset ring in the focus-ring-on-bg color", async ({
    page,
  }) => {
    await activate(openDialog(page));

    // Browsers make the content focusable only once it overflows; tabindex stands in for that.
    // Focused right after a keypress, so :focus-visible applies as it would when tabbing in.
    const content = page.locator("#dialog-usage-content");
    const ringColor = await content.evaluate((el: HTMLElement) => {
      el.tabIndex = -1;
      el.focus();
      const probe = document.createElement("div");
      probe.style.color = "var(--theme-color-focus-ring-on-bg)";
      el.appendChild(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    });

    await expect
      .poll(() => content.evaluate((el) => getComputedStyle(el).boxShadow))
      .toContain(`${ringColor} 0px 0px 0px 3px inset`);
  });

  test("scroll dividers stay hidden when the content fits", async ({
    page,
  }) => {
    await activate(openDialog(page));

    const dividers = page.locator("#dialog-usage .divider");
    await expect(dividers).toHaveCount(2);
    for (const divider of await dividers.all()) {
      await expect(divider).toHaveCSS("opacity", "0");
    }
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

  test("with an icon, the icon and headline are centered and the icon is decorative", async ({
    page,
  }) => {
    await activate(
      trigger(page, "dialog-acknowledge-icon", "Open Notification Dialog")
    );

    const dialog = page.locator("#dialog-acknowledge-icon");
    await expect(dialog.locator("header")).toHaveCSS("align-items", "center");
    await expect(dialog.locator("h2")).toHaveCSS("text-align", "center");

    const icon = dialog.locator("header svg");
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await expect(icon).toHaveCSS("width", "24px");
    await expect(icon).toHaveCSS(
      "fill",
      await resolvedColor(page, "var(--theme-color-secondary)")
    );
    await expect(dialog).toHaveAccessibleName("Message sent");
  });
});
