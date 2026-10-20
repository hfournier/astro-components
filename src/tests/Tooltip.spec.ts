import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box } from "./support/helpers";

// Each case on /tests/tooltip is a Section with data-testid="tooltip-<caseId>": plain holds a plain
// tooltip inside an icon-only link, plain-below the same placed below, plain-row three ButtonIcons
// (Edit, Copy, Share), plain-touch a ButtonIcon (Delete) that counts its clicks in data-clicks,
// rich a rich tooltip with a subhead and an action after the ButtonIcon it describes, and
// rich-persistent a persistent rich tooltip after the Button ("Release notes") that toggles it.
type TooltipCaseId =
  | "plain"
  | "plain-below"
  | "plain-row"
  | "plain-touch"
  | "rich"
  | "rich-persistent";

const tooltipCase = (page: Page, caseId: TooltipCaseId) =>
  page.getByTestId(`tooltip-${caseId}`);

const plainTrigger = (page: Page) =>
  tooltipCase(page, "plain").getByRole("link", { name: "GitHub repository" });
const plainTooltip = (page: Page) =>
  plainTrigger(page).locator("[data-ac-tooltip]");
const rowButton = (page: Page, name: string) =>
  tooltipCase(page, "plain-row").getByRole("button", { name });
const rowTooltip = (page: Page, name: string) =>
  rowButton(page, name).locator("[data-ac-tooltip]");

const richTrigger = (page: Page) =>
  tooltipCase(page, "rich").getByRole("button", { name: "About autosave" });
const richTooltip = (page: Page) =>
  tooltipCase(page, "rich").locator("[data-ac-tooltip-rich]");

const persistentTrigger = (page: Page) =>
  tooltipCase(page, "rich-persistent").getByRole("button", {
    name: "Release notes",
  });
const persistentTooltip = (page: Page) =>
  tooltipCase(page, "rich-persistent").locator("[data-ac-tooltip-rich]");

const isOpen = (tooltip: Locator) =>
  tooltip.evaluate((el) => el.matches(":popover-open"));

// M3's delays: a tooltip shows 500ms into a hover, and stays 1.5s after the pointer leaves. These
// tests install Playwright's clock and pause it, so time only moves with runFor. A paused clock
// also holds the tooltips' fades, so afterEach resumes it before the a11y scan waits for them.
const hoverDelay = 500;
const lingerDelay = 1500;
const pausedPages = new WeakSet<Page>();
async function gotoWithPausedClock(page: Page) {
  await page.clock.install();
  await page.goto("/tests/tooltip");
  await page.clock.pauseAt(Date.now() + 1000);
  pausedPages.add(page);
}

test.describe("Tooltip", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/tooltip");
  });
  test.afterEach(async ({ page }) => {
    if (pausedPages.has(page)) await page.clock.resume();
  });

  test.describe("plain", () => {
    test("is M3's 24px high plain tooltip", async ({ page }) => {
      await plainTrigger(page).focus();
      await expect(plainTooltip(page)).toBeVisible();

      expect((await box(plainTooltip(page))).height).toBe(24);
    });

    test("repeats its element's name, hidden from assistive tech, and is hidden at rest", async ({
      page,
    }) => {
      await expect(plainTooltip(page)).toHaveText("GitHub repository");
      await expect(plainTooltip(page)).toHaveAttribute("aria-hidden", "true");
      await expect(plainTooltip(page)).not.toHaveAttribute("role");
      await expect(plainTooltip(page)).toBeHidden();
    });

    test("sits 4px above its element, as M3 places it by default", async ({
      page,
    }) => {
      await plainTrigger(page).focus();
      await expect(plainTooltip(page)).toBeVisible();

      // polled, as focusing the element can scroll the page between the two measurements
      await expect
        .poll(async () => {
          const trigger = await box(plainTrigger(page));
          const tooltip = await box(plainTooltip(page));
          return Math.round(trigger.y - (tooltip.y + tooltip.height));
        })
        .toBe(4);
    });

    test('with placement="below", sits 4px below it, as in an app bar', async ({
      page,
    }) => {
      const trigger = tooltipCase(page, "plain-below").getByRole("link");
      const tooltip = trigger.locator("[data-ac-tooltip]");
      await trigger.focus();
      await expect(tooltip).toBeVisible();

      await expect
        .poll(async () => {
          const triggerBox = await box(trigger);
          return Math.round(
            (await box(tooltip)).y - (triggerBox.y + triggerBox.height)
          );
        })
        .toBe(4);
    });

    test("shows 500ms into a hover", async ({ page }) => {
      await gotoWithPausedClock(page);
      await plainTrigger(page).hover();

      await page.clock.runFor(hoverDelay - 100);
      await expect(plainTooltip(page)).toBeHidden();
      await page.clock.runFor(100);
      await expect(plainTooltip(page)).toBeVisible();
    });

    test("stays 1.5s after the pointer leaves, then hides", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await plainTrigger(page).hover();
      await page.clock.runFor(hoverDelay);
      await expect(plainTooltip(page)).toBeVisible();

      await page.mouse.move(0, 0);
      await page.clock.runFor(lingerDelay - 100);
      await expect(plainTooltip(page)).toBeVisible();
      await page.clock.runFor(100);
      await expect(plainTooltip(page)).toBeHidden();
      await expect.poll(() => isOpen(plainTooltip(page))).toBe(false);
    });

    test("shows straight away on keyboard focus, and Escape hides it in place", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await plainTrigger(page).focus();
      await expect(plainTooltip(page)).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(plainTooltip(page)).toBeHidden();
      await expect(plainTrigger(page)).toBeFocused();
    });

    test("with reduced motion, keeps the hover delay but doesn't fade", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await gotoWithPausedClock(page);
      const property = await plainTooltip(page).evaluate(
        (el) => getComputedStyle(el).transitionProperty
      );

      expect(property).toContain("visibility");
      expect(property).not.toContain("opacity");
      await plainTrigger(page).hover();
      await page.clock.runFor(hoverDelay - 100);
      await expect(plainTooltip(page)).toBeHidden();
      await page.clock.runFor(100);
      await expect(plainTooltip(page)).toBeVisible();
    });

    test("shows one at a time: a new tooltip closes the last one straight away", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await rowButton(page, "Edit").hover();
      await page.clock.runFor(hoverDelay);
      await expect(rowTooltip(page, "Edit")).toBeVisible();

      await rowButton(page, "Copy").hover();
      await page.clock.runFor(hoverDelay);
      await expect(rowTooltip(page, "Copy")).toBeVisible();
      // well within the Edit tooltip's 1.5s linger
      await expect(rowTooltip(page, "Edit")).toBeHidden();
    });

    test("a hovered element's tooltip closes a focused one's", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await rowButton(page, "Edit").focus();
      await expect(rowTooltip(page, "Edit")).toBeVisible();

      await rowButton(page, "Share").hover();
      await page.clock.runFor(hoverDelay);
      await expect(rowTooltip(page, "Share")).toBeVisible();
      await expect(rowTooltip(page, "Edit")).toBeHidden();
    });
  });

  test.describe("plain, on a touchscreen", () => {
    test.use({ hasTouch: true });

    const touchButton = (page: Page) =>
      tooltipCase(page, "plain-touch").getByRole("button", { name: "Delete" });
    const touchTooltip = (page: Page) =>
      touchButton(page).locator("[data-ac-tooltip]");
    const touch = (target: Locator, type: string) =>
      target.dispatchEvent(type, {
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
      });

    test("a short tap activates the element without showing its tooltip", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      // a tap doesn't scroll to its point, so bring the button into view first
      await touchButton(page).scrollIntoViewIfNeeded();
      const { x, y, width, height } = await box(touchButton(page));
      await page.touchscreen.tap(x + width / 2, y + height / 2);
      await page.clock.runFor(hoverDelay + lingerDelay);

      await expect(touchButton(page)).toHaveAttribute("data-clicks", "1");
      await expect(touchTooltip(page)).toBeHidden();
    });

    test("a long press shows the tooltip without activating the element, and it stays 1.5s after the finger lifts", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await touch(touchButton(page), "pointerdown");
      await page.clock.runFor(hoverDelay);
      await expect(touchTooltip(page)).toBeVisible();

      await touch(touchButton(page), "pointerup");
      await touchButton(page).dispatchEvent("click");
      await expect(touchButton(page)).not.toHaveAttribute("data-clicks");

      await page.clock.runFor(lingerDelay - 100);
      await expect(touchTooltip(page)).toBeVisible();
      await page.clock.runFor(100);
      await expect(touchTooltip(page)).toBeHidden();

      // the next tap isn't swallowed
      await touchButton(page).dispatchEvent("click");
      await expect(touchButton(page)).toHaveAttribute("data-clicks", "1");
    });

    test("when no click follows a long press, a later click still activates the element", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await touch(touchButton(page), "pointerdown");
      await page.clock.runFor(hoverDelay);
      await touch(touchButton(page), "pointerup");
      await page.clock.runFor(1000);

      await touchButton(page).dispatchEvent("click");
      await expect(touchButton(page)).toHaveAttribute("data-clicks", "1");
    });

    test("lifting the finger before the long press ends shows nothing", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await touch(touchButton(page), "pointerdown");
      await page.clock.runFor(hoverDelay - 200);
      await touch(touchButton(page), "pointerup");
      await page.clock.runFor(lingerDelay);

      await expect(touchTooltip(page)).toBeHidden();
    });

    test("doesn't open the element's context menu during a press, but still does for a mouse", async ({
      page,
    }) => {
      const contextMenu = () =>
        touchButton(page).evaluate((el) => {
          const event = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
          });
          el.dispatchEvent(event);
          return event.defaultPrevented;
        });

      expect(await contextMenu()).toBe(false);
      await touch(touchButton(page), "pointerdown");
      expect(await contextMenu()).toBe(true);
      await touch(touchButton(page), "pointerup");
    });
  });

  test.describe("rich", () => {
    test("describes its trigger with its subhead and text, not its actions", async ({
      page,
    }) => {
      const describedBy =
        await richTrigger(page).getAttribute("aria-describedby");
      const description = page.locator(`[id="${describedBy}"]`);

      await expect(description).toContainText("Autosave is on");
      await expect(description).toContainText("Changes are saved as you type");
      await expect(description).not.toContainText("Learn more");
      await expect(richTooltip(page)).toBeHidden();
    });

    test("has the tooltip role", async ({ page }) => {
      await expect(richTooltip(page)).toHaveAttribute("role", "tooltip");
    });

    test("opens on hover, and closes 1.5s after the pointer has left", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await richTrigger(page).hover();
      await page.clock.runFor(hoverDelay);
      await expect(richTooltip(page)).toBeVisible();

      await page.mouse.move(0, 0);
      await page.clock.runFor(lingerDelay - 100);
      expect(await isOpen(richTooltip(page))).toBe(true);
      await page.clock.runFor(100);
      await expect.poll(() => isOpen(richTooltip(page))).toBe(false);
    });

    test("opens on keyboard focus, lets Tab reach its action, and Escape returns focus", async ({
      page,
    }) => {
      await richTrigger(page).focus();
      await expect(richTooltip(page)).toBeVisible();

      await page.keyboard.press("Tab");
      await expect(
        richTooltip(page).getByRole("button", { name: "Learn more" })
      ).toBeFocused();
      expect(await isOpen(richTooltip(page))).toBe(true);

      await page.keyboard.press("Escape");
      await expect.poll(() => isOpen(richTooltip(page))).toBe(false);
      await expect(richTrigger(page)).toBeFocused();
    });

    test("clicking its action closes it, and it opens again on the next hover", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await richTrigger(page).hover();
      await page.clock.runFor(hoverDelay);
      await expect(richTooltip(page)).toBeVisible();

      await richTooltip(page)
        .getByRole("button", { name: "Learn more" })
        .click();
      await expect.poll(() => isOpen(richTooltip(page))).toBe(false);

      await page.mouse.move(0, 0);
      await richTrigger(page).hover();
      await page.clock.runFor(hoverDelay);
      await expect(richTooltip(page)).toBeVisible();
    });

    test("activating its action from the keyboard closes it, and returns focus without reopening it", async ({
      page,
    }) => {
      await richTrigger(page).focus();
      await expect(richTooltip(page)).toBeVisible();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect.poll(() => isOpen(richTooltip(page))).toBe(false);
      await expect(richTrigger(page)).toBeFocused();
      // let a keyboard focus's (zero-delay) open run, had it been scheduled
      await page.evaluate(() => new Promise((done) => setTimeout(done, 50)));
      expect(await isOpen(richTooltip(page))).toBe(false);
    });

    test("a plain tooltip opening closes it straight away", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await richTrigger(page).hover();
      await page.clock.runFor(hoverDelay);
      await expect(richTooltip(page)).toBeVisible();

      await plainTrigger(page).hover();
      await page.clock.runFor(hoverDelay);
      await expect(plainTooltip(page)).toBeVisible();
      await expect.poll(() => isOpen(richTooltip(page))).toBe(false);
    });
  });

  test.describe("rich, persistent", () => {
    test("opens on a click, not on hover or focus, and marks its element expanded", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await persistentTrigger(page).hover();
      await page.clock.runFor(hoverDelay);
      await persistentTrigger(page).focus();
      expect(await isOpen(persistentTooltip(page))).toBe(false);
      await expect(persistentTrigger(page)).toHaveAttribute(
        "aria-expanded",
        "false"
      );

      await persistentTrigger(page).click();
      await expect(persistentTooltip(page)).toBeVisible();
      await expect(persistentTrigger(page)).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      await expect(persistentTooltip(page)).toHaveAttribute("role", "tooltip");
    });

    test("stays open when the pointer leaves, and a click elsewhere closes it", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await persistentTrigger(page).click();
      await expect(persistentTooltip(page)).toBeVisible();

      await page.mouse.move(0, 0);
      await page.clock.runFor(lingerDelay * 2);
      expect(await isOpen(persistentTooltip(page))).toBe(true);

      await page.getByRole("heading", { name: "Tooltip Tests" }).click();
      await expect.poll(() => isOpen(persistentTooltip(page))).toBe(false);
      await expect(persistentTrigger(page)).toHaveAttribute(
        "aria-expanded",
        "false"
      );
    });

    test("focus moving elsewhere closes it, but another tooltip showing doesn't", async ({
      page,
    }) => {
      await gotoWithPausedClock(page);
      await persistentTrigger(page).click();
      await expect(persistentTooltip(page)).toBeVisible();

      await rowButton(page, "Edit").hover();
      await page.clock.runFor(hoverDelay);
      await expect(rowTooltip(page, "Edit")).toBeVisible();
      expect(await isOpen(persistentTooltip(page))).toBe(true);

      await plainTrigger(page).focus();
      await expect.poll(() => isOpen(persistentTooltip(page))).toBe(false);
    });

    test("Escape closes it, and a second click on its element does too", async ({
      page,
    }) => {
      await persistentTrigger(page).click();
      await expect(persistentTooltip(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect.poll(() => isOpen(persistentTooltip(page))).toBe(false);

      await persistentTrigger(page).click();
      await expect(persistentTooltip(page)).toBeVisible();
      await persistentTrigger(page).click();
      await expect.poll(() => isOpen(persistentTooltip(page))).toBe(false);
    });

    test("clicking one of its actions closes it, and returns focus to its element", async ({
      page,
    }) => {
      await persistentTrigger(page).click();
      await expect(persistentTooltip(page)).toBeVisible();

      await persistentTooltip(page)
        .getByRole("button", { name: "Got it" })
        .click();
      await expect.poll(() => isOpen(persistentTooltip(page))).toBe(false);
      await expect(persistentTrigger(page)).toBeFocused();
      await expect(persistentTrigger(page)).toHaveAttribute(
        "aria-expanded",
        "false"
      );
    });

    test("describes its element with its subhead and text", async ({
      page,
    }) => {
      const describedBy =
        await persistentTrigger(page).getAttribute("aria-describedby");

      const description = page.locator(`[id="${describedBy}"]`);

      await expect(description).toContainText("Version history");
      await expect(description).toContainText("See every saved version");
      await expect(description).not.toContainText("Got it");
    });
  });
});
