import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/sheet-side is a Section with data-testid="sheet-side-<caseId>" holding one
// SheetSide: modal (the "Details" sheet on the end edge), modal-start (on the start edge),
// modal-detached (detached, with Save and Cancel actions), each with its own opener, and standard
// sheets, each the last column of a flex row: standard ("Filters", with its default close button
// and content wider than itself), permanent ("Contents", showCloseX={false}), back ("Item
// details", with a back button) and rtl ("Détails", right to left, with French back and close
// labels).
type SheetSideCaseId =
  | "modal"
  | "modal-start"
  | "modal-detached"
  | "standard"
  | "permanent"
  | "back"
  | "rtl";

const sheetCase = (page: Page, caseId: SheetSideCaseId) =>
  page.getByTestId(`sheet-side-${caseId}`);

// The modal cases' opener labels
type ModalCaseId = Extract<
  SheetSideCaseId,
  "modal" | "modal-start" | "modal-detached"
>;
const OPENER_LABELS: Record<ModalCaseId, string> = {
  modal: "Open side sheet",
  "modal-start": "Open start side sheet",
  "modal-detached": "Open detached side sheet",
};

const modalSheet = (page: Page, caseId: ModalCaseId) =>
  sheetCase(page, caseId).locator('[data-ac-sheet-side="modal"]');
const opener = (page: Page, caseId: ModalCaseId) =>
  sheetCase(page, caseId).getByRole("button", {
    name: OPENER_LABELS[caseId],
    exact: true,
  });
const viewportWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.clientWidth);
const isOpen = (sheet: Locator) =>
  sheet.evaluate((el) => (el as HTMLDialogElement).open);
// The accessible names of the buttons in a sheet's header, in order
const buttonNames = (header: Locator) =>
  header
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")));
const returnValue = (sheet: Locator) =>
  sheet.evaluate((el) => (el as HTMLDialogElement).returnValue);

// Records the sheet's cancel/close events (with its returnValue at close) for later assertion
const recordEvents = (sheet: Locator) =>
  sheet.evaluate((el: HTMLDialogElement) => {
    const events: string[] = [];
    (el as HTMLDialogElement & { events: string[] }).events = events;
    el.addEventListener("cancel", () => events.push("cancel"));
    el.addEventListener("close", () => events.push(`close:${el.returnValue}`));
  });
const recordedEvents = (sheet: Locator) =>
  sheet.evaluate(
    (el) => (el as HTMLDialogElement & { events: string[] }).events
  );

test.describe("SheetSide", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/sheet-side");
  });

  test.describe("modal", () => {
    const sheet = (page: Page) => modalSheet(page, "modal");

    test("opens from its button as a dialog named by its headline, 256px wide on the end edge", async ({
      page,
    }) => {
      await expect(sheet(page)).toBeHidden();
      await opener(page, "modal").click();

      await expect(
        page.getByRole("dialog", { name: "Details", exact: true })
      ).toBeVisible();
      // it slides in, so poll until it's in place
      await expect
        .poll(async () => {
          const { x, width } = await box(sheet(page));
          return x + width;
        })
        .toBe(await viewportWidth(page));
      const { width, height } = await box(sheet(page));
      expect(width).toBe(256);
      expect(height).toBe(page.viewportSize()!.height);
    });

    test("uses M3's surface, with its headline in on-surface-variant", async ({
      page,
    }) => {
      await opener(page, "modal").click();

      await expect(sheet(page).locator("> *")).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
      await expect(
        sheet(page).getByRole("heading", { name: "Details" })
      ).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface-variant)")
      );
    });

    test("its close button shows its label as a tooltip on hover", async ({
      page,
    }) => {
      await opener(page, "modal").click();
      const close = sheet(page).getByRole("button", { name: "Close" });
      const tooltip = close.locator("[data-ac-tooltip]");

      await expect(tooltip).toHaveText("Close");
      await close.hover();
      await expect(tooltip).toBeVisible();
    });

    test("closes with its close button, Escape or a click on the scrim", async ({
      page,
    }) => {
      const open = async () => {
        await opener(page, "modal").click();
        await expect.poll(() => isOpen(sheet(page))).toBe(true);
      };

      await open();
      await sheet(page).getByRole("button", { name: "Close" }).click();
      await expect.poll(() => isOpen(sheet(page))).toBe(false);

      await open();
      await page.keyboard.press("Escape");
      await expect.poll(() => isOpen(sheet(page))).toBe(false);

      await open();
      await page.mouse.click(100, 300);
      await expect.poll(() => isOpen(sheet(page))).toBe(false);
    });

    test("closes with an action's value, and with an empty returnValue on its close button, Escape or the scrim after it", async ({
      page,
    }) => {
      const detached = modalSheet(page, "modal-detached");
      const open = async () => {
        await opener(page, "modal-detached").click();
        await expect.poll(() => isOpen(detached)).toBe(true);
      };
      const save = async () => {
        await open();
        await detached.getByRole("button", { name: "Save" }).click();
        await expect.poll(() => isOpen(detached)).toBe(false);
        expect(await returnValue(detached)).toBe("save");
      };
      const closedEmpty = async () => {
        await expect.poll(() => isOpen(detached)).toBe(false);
        expect(await returnValue(detached)).toBe("");
      };

      await save();
      await open();
      await detached.getByRole("button", { name: "Close" }).click();
      await closedEmpty();

      await save();
      await open();
      await page.keyboard.press("Escape");
      await closedEmpty();

      await save();
      await open();
      await page.mouse.click(5, 300);
      await closedEmpty();
    });

    test("a click on the scrim cancels it like Escape, unless the page prevents cancel", async ({
      page,
    }) => {
      const open = async () => {
        await opener(page, "modal").click();
        await expect.poll(() => isOpen(sheet(page))).toBe(true);
      };

      await open();
      await sheet(page).evaluate((el) => {
        el.addEventListener("cancel", (event) => event.preventDefault(), {
          once: true,
        });
      });
      await page.mouse.click(100, 300);
      expect(await isOpen(sheet(page))).toBe(true);

      await recordEvents(sheet(page));
      await page.mouse.click(100, 300);
      await expect.poll(() => isOpen(sheet(page))).toBe(false);
      expect(await recordedEvents(sheet(page))).toEqual(["cancel", "close:"]);
    });

    test("stays open when a press starts in its content and ends on the scrim", async ({
      page,
    }) => {
      await opener(page, "modal").click();
      await expect
        .poll(async () => {
          const { x, width } = await box(sheet(page));
          return x + width;
        })
        .toBe(await viewportWidth(page));

      const { x, y } = await box(sheet(page).locator("p"));
      await page.mouse.move(x + 2, y + 2);
      await page.mouse.down();
      await page.mouse.move(100, 300, { steps: 5 });
      await page.mouse.up();

      expect(await isOpen(sheet(page))).toBe(true);
    });

    test("a start sheet sits on the start edge", async ({ page }) => {
      const start = modalSheet(page, "modal-start");

      await opener(page, "modal-start").click();
      await expect.poll(async () => (await box(start)).x).toBe(0);
    });

    test("a detached sheet is 16px from the window's edges, with its actions in M3's 72px row", async ({
      page,
    }) => {
      const detached = modalSheet(page, "modal-detached");
      await opener(page, "modal-detached").click();

      await expect
        .poll(async () => {
          const { x, width } = await box(detached);
          return x + width;
        })
        .toBe((await viewportWidth(page)) - 16);
      const { y, height } = await box(detached);
      expect(y).toBe(16);
      expect(height).toBe(page.viewportSize()!.height - 32);

      const actions = detached
        .getByRole("button", { name: "Save" })
        .locator("..");
      expect((await box(actions)).height).toBeGreaterThanOrEqual(72);
    });

    test("puts its actions in a <footer>", async ({ page }) => {
      // read closed, so includeHidden
      await expect(
        modalSheet(page, "modal-detached")
          .locator("footer")
          .getByRole("button", { includeHidden: true })
      ).toHaveText(["Save", "Cancel"]);
    });
  });

  test.describe("standard", () => {
    const sheet = (page: Page) =>
      sheetCase(page, "standard").getByRole("complementary", {
        name: "Filters",
      });

    test("is an aside beside the content, 256px wide on M3's surface with a divider on its inner edge", async ({
      page,
    }) => {
      await expect(sheet(page)).toBeVisible();
      // close to: Firefox lays out in 1/60px units, so it can be a hair over
      expect((await box(sheet(page))).width).toBeCloseTo(256, 2);
      const surface = sheet(page).locator("> *");
      await expect(surface).toHaveCSS("border-left-width", "1px");
      await expect(surface).toHaveCSS(
        "border-left-color",
        await resolvedColor(page, "var(--theme-color-outline-variant)")
      );
      await expect(surface).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface)")
      );
    });

    test("puts its headline and close button in a <header>", async ({
      page,
    }) => {
      const header = sheet(page).locator("header");
      await expect(
        header.getByRole("heading", { name: "Filters" })
      ).toBeVisible();
      await expect(header.getByRole("button", { name: "Close" })).toBeVisible();
    });

    test("its close button hides it", async ({ page }) => {
      await sheet(page).getByRole("button", { name: "Close" }).click();
      await expect(sheet(page)).toBeHidden();
    });

    test("its headline is on-surface-variant", async ({ page }) => {
      await expect(
        sheet(page).getByRole("heading", { name: "Filters" })
      ).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface-variant)")
      );
    });

    test("doesn't scroll sideways when its content is wider than it", async ({
      page,
    }) => {
      const content = sheet(page).getByText("Content wider than the sheet.");
      await expect(content.locator("..")).toHaveCSS("overflow-x", "hidden");

      // not the wide element, which Playwright would scroll into view itself
      await sheet(page).getByText("Controls that filter").hover();
      await page.mouse.wheel(300, 0);
      await page.mouse.wheel(-300, 0);
      await page.mouse.wheel(300, 0);
      expect(await content.locator("..").evaluate((el) => el.scrollLeft)).toBe(
        0
      );
    });

    test("showCloseX={false} leaves the close button out", async ({ page }) => {
      const permanent = sheetCase(page, "permanent").getByRole(
        "complementary",
        { name: "Contents" }
      );
      await expect(permanent).toBeVisible();
      await expect(permanent.getByRole("button")).toHaveCount(0);
    });
  });

  test.describe("back button", () => {
    const sheet = (page: Page) =>
      sheetCase(page, "back").getByRole("complementary", {
        name: "Item details",
      });
    const back = (page: Page) =>
      sheet(page).getByRole("button", { name: "Back", exact: true });

    test("comes first in the header, with 16px of start padding", async ({
      page,
    }) => {
      const header = sheet(page).locator("header");
      expect(await buttonNames(header)).toEqual(["Back", "Close"]);
      await expect(header).toHaveCSS("padding-left", "16px");
      const sheetBox = await box(sheet(page));
      // the sheet's divider is 1px, on its start (left) edge
      expect((await box(back(page))).x).toBeCloseTo(sheetBox.x + 1 + 16, 1);
    });

    test("a click fires a cancelable back event on the sheet, which stays open", async ({
      page,
    }) => {
      await sheet(page).evaluate((el) => {
        el.addEventListener("back", (event) => {
          (el as HTMLElement & { back: unknown }).back = {
            isCustomEvent: event instanceof CustomEvent,
            cancelable: event.cancelable,
          };
        });
      });
      await back(page).click();

      expect(
        await sheet(page).evaluate(
          (el) => (el as HTMLElement & { back: unknown }).back
        )
      ).toEqual({ isCustomEvent: true, cancelable: true });
      await expect(sheet(page)).toBeVisible();
    });

    test("shows its label as a tooltip on hover", async ({ page }) => {
      const tooltip = back(page).locator("[data-ac-tooltip]");
      await expect(tooltip).toHaveText("Back");
      await back(page).hover();
      await expect(tooltip).toBeVisible();
    });

    test("right to left, it takes its own labels, sits on the right and its arrow flips", async ({
      page,
    }) => {
      const rtl = sheetCase(page, "rtl").getByRole("complementary", {
        name: "Détails",
      });
      const header = rtl.locator("header");
      expect(await buttonNames(header)).toEqual(["Retour", "Fermer"]);
      await expect(header).toHaveCSS("padding-right", "16px");

      const rtlArrow = rtl
        .getByRole("button", { name: "Retour" })
        .locator("svg");
      const ltrArrow = back(page).locator("svg");
      // the arrow's horizontal scale, -1 when mirrored
      const scaleX = (arrow: Locator) =>
        arrow.evaluate((el) => {
          const { scale } = getComputedStyle(el);
          return scale === "none" ? 1 : parseFloat(scale);
        });
      expect(await scaleX(ltrArrow)).toBe(1);
      expect(await scaleX(rtlArrow)).toBe(-1);
    });
  });
});
