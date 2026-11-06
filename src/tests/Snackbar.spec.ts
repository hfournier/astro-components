import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, colorInside, css, elevation, settled } from "./support/helpers";

// Each case on /tests/snackbar is a Section with data-testid="snackbar-<caseId>", holding the
// button that shows its snackbar
type SnackbarCaseId =
  | "single"
  | "action"
  | "close"
  | "action-only"
  | "two-line"
  | "two-line-text"
  | "new-line"
  | "long"
  | "queue"
  | "rtl";

const section = (page: Page, caseId: SnackbarCaseId) =>
  page.getByTestId(`snackbar-${caseId}`);

const snackbarOf = (page: Page, id: string) => page.locator(`#${id}`);
const textOf = (snackbar: Locator) =>
  snackbar.locator("[data-ac-snackbar-part=text]");
const liveOf = (page: Page, id: string) =>
  page.locator(`[data-ac-snackbar-live="${id}"]`);

// From the keyboard, so the button keeps focus in every engine (WebKit doesn't focus a clicked
// button)
// Waits for it to settle, except under a paused clock, where animations never finish
const show = async (
  page: Page,
  caseId: SnackbarCaseId,
  name: string,
  isSettled = true
) => {
  await section(page, caseId).getByRole("button", { name }).focus();
  await page.keyboard.press("Enter");
  if (isSettled) await settled(page);
};

const viewport = (page: Page) => page.viewportSize()!;

test.describe("anatomy", () => {
  test("a single-line snackbar is 48px of Body Medium on inverse surface, 12px from the window's bottom and past its navigation", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-single");
    await expect(snackbar).toBeHidden();
    await show(page, "single", "Archive");
    await expect(snackbar).toBeVisible();

    const rect = await box(snackbar);
    expect(rect.height).toBe(48);
    // past the site's navigation rail (and drawer, in a large window), running the window's
    // height down its start side
    const navigation = await page.evaluate(() =>
      Math.max(
        ...[
          ...document.querySelectorAll(
            "[data-ac-nav-rail], [data-ac-nav-drawer]"
          ),
        ]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.right > 0)
          .map((r) => r.right)
      )
    );
    expect(navigation).toBeGreaterThan(0);
    expect(rect.x).toBe(navigation + 12);
    expect(viewport(page).height - (rect.y + rect.height)).toBe(12);

    expect(await css(snackbar, "background-color")).toBe(
      await colorInside(snackbar, "--theme-color-inverse-surface")
    );
    const text = textOf(snackbar);
    expect(await css(text, "color")).toBe(
      await colorInside(snackbar, "--theme-color-inverse-on-surface")
    );
    expect(await css(text, "font-size")).toBe("14px");
    expect(await css(text, "line-height")).toBe("20px");
    expect(await css(text, "font-weight")).toBe("400");
    expect(await css(snackbar, "border-top-left-radius")).toBe("4px");
    expect(await css(snackbar, "box-shadow")).toContain(
      await elevation(page, 3)
    );
    // 16px before the text, 16px after it without an action
    const textRect = await box(text.locator("xpath=.."));
    expect(textRect.x - rect.x).toBe(0);
    const words = await text.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      return { left: r.left, right: r.right };
    });
    expect(Math.round(words.left - rect.x)).toBe(16);
  });

  test("an action and a close button: the action in inverse primary, 8px apart from the text, the close icon 12px from both", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-action");
    await show(page, "action", "Delete");
    const rect = await box(snackbar);
    expect(rect.height).toBe(48);

    const undo = snackbar.getByRole("button", { name: "Undo" });
    expect(await css(undo, "color")).toBe(
      await colorInside(snackbar, "--theme-color-inverse-primary")
    );
    const close = snackbar.getByRole("button", { name: "Dismiss" });
    const icon = await box(close.locator("svg"));
    const undoRect = await box(undo);
    expect(rect.x + rect.width - (icon.x + icon.width)).toBe(12);
    expect(icon.x - (undoRect.x + undoRect.width)).toBe(12);
    expect(icon.width).toBe(24);
  });

  test("a single-line snackbar with only an action is 48px, ending 8px after the action", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-action-only");
    await show(page, "action-only", "Archive all");
    const rect = await box(snackbar);
    expect(rect.height).toBe(48);
    const undo = await box(snackbar.getByRole("button", { name: "Undo all" }));
    expect(rect.x + rect.width - (undo.x + undo.width)).toBe(8);
  });

  test("two lines of text alone make a 68px snackbar", async ({ page }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-two-line-text");
    await show(page, "two-line-text", "Upload");
    const rect = await box(snackbar);
    expect(rect.height).toBe(68);
    expect(rect.width).toBe(600);
  });

  test("in the dark theme it keeps its inverse roles", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-action");
    await show(page, "action", "Delete");
    const role = (name: string) => colorInside(snackbar, name);
    expect(await css(snackbar, "background-color")).toBe(
      await role("--theme-color-inverse-surface")
    );
    expect(await css(textOf(snackbar), "color")).toBe(
      await role("--theme-color-inverse-on-surface")
    );
    expect(
      await css(snackbar.getByRole("button", { name: "Undo" }), "color")
    ).toBe(await role("--theme-color-inverse-primary"));
    // dark: inverse surface is the light one, unlike the page's
    expect(await role("--theme-color-inverse-surface")).not.toBe(
      await role("--theme-color-surface")
    );
  });

  test("two lines of text make a 68px snackbar, the action beside them", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-two-line");
    await show(page, "two-line", "Move");
    const rect = await box(snackbar);
    expect(rect.height).toBe(68);
    // it fits its text up to 600px wide
    expect(rect.width).toBe(600);
    const text = await box(textOf(snackbar));
    const open = await box(snackbar.getByRole("button", { name: "Open" }));
    expect(open.x).toBeGreaterThan(text.x + text.width - 1);
  });

  test("a longer action goes on its own line, below the text and at the end", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-new-line");
    await show(page, "new-line", "Sync");
    const rect = await box(snackbar);
    const text = await box(textOf(snackbar));
    const action = await box(
      snackbar.getByRole("button", { name: "Try again now" })
    );
    expect(action.y).toBeGreaterThanOrEqual(text.y + text.height);
    expect(rect.x + rect.width - (action.x + action.width)).toBe(8);
    // 4px below the action
    expect(rect.y + rect.height - (action.y + action.height)).toBe(4);
  });

  test("in a compact window it spans the window, 12px from each edge", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-single");
    await show(page, "single", "Archive");
    const rect = await box(snackbar);
    expect(rect.x).toBe(12);
    expect(rect.width).toBe(400 - 24);
  });

  test("it mirrors in right-to-left: at the window's right, the close button at its left end", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-rtl");
    await show(page, "rtl", "Delete RTL");
    const rect = await box(snackbar);
    expect(viewport(page).width - (rect.x + rect.width)).toBe(12);
    const close = await box(
      snackbar.getByRole("button", { name: "Dismiss RTL" })
    );
    const undo = await box(snackbar.getByRole("button", { name: "Undo RTL" }));
    const text = await box(textOf(snackbar));
    expect(close.x).toBeLessThan(undo.x);
    expect(undo.x).toBeLessThan(text.x);
  });
});

test.describe("timing", () => {
  test.beforeEach(async ({ page }) => {
    // paused, so time only passes as each test runs it on
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  });
  // running again, so the axe scan after each test can wait for the page's animations to end
  test.afterEach(async ({ page }) => {
    await page.clock.resume();
  });

  test("without an action it hides after 4 seconds", async ({ page }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-single");
    await show(page, "single", "Archive", false);
    await page.clock.runFor(3900);
    await expect(snackbar).toBeVisible();
    await page.clock.runFor(200);
    await expect(snackbar).toBeHidden();
  });

  test("a long one hides after 10 seconds", async ({ page }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-long");
    await show(page, "long", "Copy", false);
    await page.clock.runFor(9900);
    await expect(snackbar).toBeVisible();
    await page.clock.runFor(200);
    await expect(snackbar).toBeHidden();
  });

  test("with a close button only, it still hides after 4 seconds", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-close");
    await show(page, "close", "Send", false);
    await page.clock.runFor(4100);
    await expect(snackbar).toBeHidden();
  });

  test("with an action it stays until it's acted on", async ({ page }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-action");
    await show(page, "action", "Delete", false);
    await page.clock.runFor(60_000);
    await expect(snackbar).toBeVisible();
    await snackbar.getByRole("button", { name: "Undo" }).click();
    await expect(snackbar).toBeHidden();
  });

  test("it waits while hovered, and times out once the pointer leaves", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-single");
    await show(page, "single", "Archive", false);
    await page.clock.runFor(2000);
    await snackbar.hover();
    await page.clock.runFor(10_000);
    await expect(snackbar).toBeVisible();
    await page.mouse.move(600, 10);
    // what was left of its 4 seconds
    await page.clock.runFor(1900);
    await expect(snackbar).toBeVisible();
    await page.clock.runFor(200);
    await expect(snackbar).toBeHidden();
  });

  test("it waits while it holds focus", async ({ page }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-close");
    await show(page, "close", "Send", false);
    await page.mouse.move(600, 10);
    await page.keyboard.press("Alt+g");
    // without a closeLabel, the close button is named "Close"
    await expect(
      snackbar.getByRole("button", { name: "Close", exact: true })
    ).toBeFocused();
    await page.clock.runFor(10_000);
    await expect(snackbar).toBeVisible();
  });

  test("one shows at a time: a second waits until the first hides", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const first = snackbarOf(page, "snackbar-queue-first");
    const second = snackbarOf(page, "snackbar-queue-second");
    await show(page, "queue", "Show first", false);
    await show(page, "queue", "Show second", false);
    await expect(first).toBeVisible();
    await expect(second).toBeHidden();
    await page.clock.runFor(4100);
    await expect(first).toBeHidden();
    await expect(second).toBeVisible();
    await page.clock.runFor(4100);
    await expect(second).toBeHidden();
  });
});

test.describe("accessibility", () => {
  test("its text is announced politely, without moving focus", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const live = liveOf(page, "snackbar-single");
    await expect(live).toHaveAttribute("role", "status");
    await expect(live).toHaveText("");
    const trigger = section(page, "single").getByRole("button", {
      name: "Archive",
    });
    await show(page, "single", "Archive");
    await expect(live).toHaveText("Email archived");
    await expect(trigger).toBeFocused();
    await snackbarOf(page, "snackbar-single").evaluate((el) =>
      (el as HTMLElement).hidePopover()
    );
    await expect(live).toHaveText("");
  });

  test("Alt+G focuses its action, Tab its close button, and Escape hides it, focus going back", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-action");
    const trigger = section(page, "action").getByRole("button", {
      name: "Delete",
    });
    await show(page, "action", "Delete");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Alt+g");
    await expect(snackbar.getByRole("button", { name: "Undo" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      snackbar.getByRole("button", { name: "Dismiss" })
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(snackbar).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("its action, pressed from the keyboard, hides it and focus goes back", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-action");
    const trigger = section(page, "action").getByRole("button", {
      name: "Delete",
    });
    await show(page, "action", "Delete");
    await page.keyboard.press("Alt+g");
    await page.keyboard.press("Enter");
    await expect(snackbar).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("its close button hides it", async ({ page }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-action");
    await show(page, "action", "Delete");
    await snackbar.getByRole("button", { name: "Dismiss" }).click();
    await expect(snackbar).toBeHidden();
  });

  test("its action and close button have a 48px target", async ({ page }) => {
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-action");
    await show(page, "action", "Delete");
    for (const name of ["Undo", "Dismiss"]) {
      const height = await snackbar
        .getByRole("button", { name })
        .evaluate((el) => getComputedStyle(el, "::after").height);
      expect(parseFloat(height)).toBeGreaterThanOrEqual(48);
    }
  });
});

test.describe("placement", () => {
  test("above a navigation bar, and a FAB when it's beneath it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto("/tests/snackbar-placement");
    await page.getByRole("button", { name: "Archive" }).click();
    await settled(page);
    const snackbar = snackbarOf(page, "snackbar-placement");
    const fab = await box(page.getByRole("button", { name: "Compose" }));
    const rect = await box(snackbar);
    expect(fab.y - (rect.y + rect.height)).toBe(12);
  });

  test("from medium up, beside a FAB at the end, it's only lifted above the navigation bar", async ({
    page,
  }) => {
    await page.goto("/tests/snackbar-placement");
    await page.getByRole("button", { name: "Archive" }).click();
    await settled(page);
    const snackbar = snackbarOf(page, "snackbar-placement");
    const bar = await box(page.locator("[data-ac-nav-bar]"));
    const rect = await box(snackbar);
    expect(bar.y - (rect.y + rect.height)).toBe(12);
  });
});

test.describe("motion", () => {
  test("under reduced motion it shows and hides at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/tests/snackbar");
    const snackbar = snackbarOf(page, "snackbar-single");
    await section(page, "single")
      .getByRole("button", { name: "Archive" })
      .click();
    expect(await css(snackbar, "opacity")).toBe("1");
    expect(await css(snackbar, "transition-duration")).toBe("0s");
  });
});
