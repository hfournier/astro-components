import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/sheet-side is a Section with data-testid="sheet-side-<caseId>" holding one
// SheetSide: modal (the "Details" sheet on the end edge), modal-start (on the start edge),
// modal-detached (detached, with Save and Cancel actions), each with its own opener, and standard
// ("Filters", the last column of a flex row, with a close button).
type SheetSideCaseId = "modal" | "modal-start" | "modal-detached" | "standard";

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
const returnValue = (sheet: Locator) =>
  sheet.evaluate((el) => (el as HTMLDialogElement).returnValue);

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

    test("uses M3's surface", async ({ page }) => {
      await opener(page, "modal").click();

      await expect(sheet(page).locator("> *")).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
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
      expect((await box(sheet(page))).width).toBe(256);
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
  });
});
