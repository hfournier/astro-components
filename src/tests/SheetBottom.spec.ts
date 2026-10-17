import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/sheet-bottom is a Section with data-testid="sheet-bottom-<caseId>" holding
// one SheetBottom: modal (the "Share" sheet and its "Open bottom sheet" button), modal-scrolling
// (the tall "Terms" sheet and its "Open tall bottom sheet" button), standard ("Now playing", the
// last child of a scrolling region) and collapsed ("Map layers", starting collapsed).
type SheetBottomCaseId = "modal" | "modal-scrolling" | "standard" | "collapsed";

const sheetCase = (page: Page, caseId: SheetBottomCaseId) =>
  page.getByTestId(`sheet-bottom-${caseId}`);

// The modal cases' opener labels
type ModalCaseId = Extract<SheetBottomCaseId, "modal" | "modal-scrolling">;
const OPENER_LABELS: Record<ModalCaseId, string> = {
  modal: "Open bottom sheet",
  "modal-scrolling": "Open tall bottom sheet",
};

const modalSheet = (page: Page, caseId: ModalCaseId) =>
  sheetCase(page, caseId).locator('[data-ac-sheet-bottom="modal"]');
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

test.describe("SheetBottom", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/sheet-bottom");
  });

  test.describe("modal", () => {
    const sheet = (page: Page) => modalSheet(page, "modal");
    const open = async (page: Page) => {
      await opener(page, "modal").click();
      // it slides up, so poll until it's in place
      await expect
        .poll(async () => {
          const { y, height } = await box(sheet(page));
          return y + height;
        })
        .toBe(page.viewportSize()!.height);
    };

    test("opens from its button as a dialog named by its headline, on the bottom edge", async ({
      page,
    }) => {
      await expect(sheet(page)).toBeHidden();
      await open(page);
      await expect(
        page.getByRole("dialog", { name: "Share", exact: true })
      ).toBeVisible();
    });

    test("puts its drag handle and headline in a <header>", async ({
      page,
    }) => {
      // read closed, so includeHidden
      const header = sheet(page).locator("header");
      await expect(
        header.getByRole("button", { name: "Close", includeHidden: true })
      ).toHaveCount(1);
      await expect(
        header.getByRole("heading", { name: "Share", includeHidden: true })
      ).toHaveCount(1);
    });

    test("uses M3's surface and a centred 32x4px drag handle with 22px above and below it", async ({
      page,
    }) => {
      await open(page);
      const handle = sheet(page).getByRole("button", { name: "Close" });

      await expect(sheet(page).locator("> *")).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );

      const bar = await box(handle.locator("> *"));
      const handleBox = await box(handle);
      const sheetBox = await box(sheet(page));
      expect(bar.width).toBe(32);
      expect(bar.height).toBe(4);
      expect(bar.y - sheetBox.y).toBe(22);
      expect(handleBox.y + handleBox.height - (bar.y + bar.height)).toBe(22);
      expect(bar.x + bar.width / 2).toBeCloseTo(
        sheetBox.x + sheetBox.width / 2,
        0
      );
    });

    test("is full width in a window up to 640px wide, with a 72px top margin", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 400, height: 600 });
      const tall = modalSheet(page, "modal-scrolling");
      await opener(page, "modal-scrolling").click();

      await expect.poll(async () => (await box(tall)).y).toBe(72);
      const { x, width } = await box(tall);
      expect(x).toBe(0);
      expect(width).toBe(await viewportWidth(page));
    });

    test("is at most 640px wide, centred, with a 56px top margin, in a wider window", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1000, height: 800 });
      const tall = modalSheet(page, "modal-scrolling");
      await opener(page, "modal-scrolling").click();

      await expect.poll(async () => (await box(tall)).y).toBe(56);
      const { x, width } = await box(tall);
      expect(width).toBe(640);
      expect(x).toBe(((await viewportWidth(page)) - 640) / 2);
    });

    test("keeps 56px from the window's start and end edges just past 640px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 700, height: 800 });
      await opener(page, "modal").click();

      await expect.poll(async () => (await box(sheet(page))).x).toBe(56);
      const { x, width } = await box(sheet(page));
      expect(x + width).toBe((await viewportWidth(page)) - 56);
    });

    test("closes with its drag handle, a drag down on it, Escape or a click on the scrim, each with an empty returnValue", async ({
      page,
    }) => {
      const handle = sheet(page).getByRole("button", { name: "Close" });
      // None of these is an action, so each must clear what an earlier opening's action left
      const closed = async () => {
        await expect.poll(() => isOpen(sheet(page))).toBe(false);
        expect(await returnValue(sheet(page))).toBe("");
      };
      const openWithStaleValue = async () => {
        await open(page);
        await sheet(page).evaluate(
          (el) => ((el as HTMLDialogElement).returnValue = "stale")
        );
      };

      await openWithStaleValue();
      await handle.click();
      await closed();

      await openWithStaleValue();
      const { x, y, width, height } = await box(handle);
      await page.mouse.move(x + width / 2, y + height / 2);
      await page.mouse.down();
      await page.mouse.move(x + width / 2, y + height / 2 + 100, { steps: 5 });
      await page.mouse.up();
      await closed();

      await openWithStaleValue();
      await page.keyboard.press("Escape");
      await closed();

      await openWithStaleValue();
      await page.mouse.click(10, 10);
      await closed();
    });

    test("a click on the scrim cancels it like Escape, unless the page prevents cancel", async ({
      page,
    }) => {
      await open(page);
      await sheet(page).evaluate((el) => {
        el.addEventListener("cancel", (event) => event.preventDefault(), {
          once: true,
        });
      });
      await page.mouse.click(10, 10);
      expect(await isOpen(sheet(page))).toBe(true);

      await recordEvents(sheet(page));
      await page.mouse.click(10, 10);
      await expect.poll(() => isOpen(sheet(page))).toBe(false);
      expect(await recordedEvents(sheet(page))).toEqual(["cancel", "close:"]);
    });

    test("stays open when a press starts in its content and ends on the scrim", async ({
      page,
    }) => {
      await open(page);

      const { x, y } = await box(sheet(page).locator("p"));
      await page.mouse.move(x + 2, y + 2);
      await page.mouse.down();
      await page.mouse.move(10, 10, { steps: 5 });
      await page.mouse.up();

      expect(await isOpen(sheet(page))).toBe(true);
    });
  });

  test.describe("standard", () => {
    const sheet = (page: Page) =>
      sheetCase(page, "standard").getByRole("complementary", {
        name: "Now playing",
      });
    const handle = (page: Page) =>
      sheet(page).getByRole("button", { name: "Sheet content" });

    test("is an aside stuck to the bottom of its scrolling region", async ({
      page,
    }) => {
      const region = sheet(page).locator("..");
      await expect(sheet(page)).toBeVisible();
      const regionBox = await box(region);
      const sheetBox = await box(sheet(page));
      // less the region's 1px border
      expect(sheetBox.y + sheetBox.height).toBeCloseTo(
        regionBox.y + regionBox.height - 1,
        0
      );
    });

    test("puts its drag handle and headline in a <header>", async ({
      page,
    }) => {
      const header = sheet(page).locator("header");
      await expect(
        header.getByRole("button", { name: "Sheet content" })
      ).toBeVisible();
      await expect(
        header.getByRole("heading", { name: "Now playing" })
      ).toBeVisible();
    });

    test("its drag handle collapses and expands it", async ({ page }) => {
      const content = sheet(page).getByText("Details about the item");
      await expect(handle(page)).toHaveAttribute("aria-expanded", "true");

      await handle(page).click();
      await expect(content).toBeHidden();
      await expect(handle(page)).toHaveAttribute("aria-expanded", "false");
      await expect(sheet(page).getByRole("heading")).toBeVisible();

      await handle(page).press("Enter");
      await expect(content).toBeVisible();
    });

    test("a collapsed sheet expands on a drag up on its handle", async ({
      page,
    }) => {
      const collapsed = sheetCase(page, "collapsed").getByRole(
        "complementary",
        { name: "Map layers" }
      );
      const collapsedHandle = collapsed.getByRole("button", {
        name: "Sheet content",
      });
      const content = collapsed.getByText(
        "Controls for the layers of the map."
      );
      await expect(content).toBeHidden();

      await collapsedHandle.scrollIntoViewIfNeeded();
      const { x, y, width, height } = await box(collapsedHandle);
      await page.mouse.move(x + width / 2, y + height / 2);
      await page.mouse.down();
      await page.mouse.move(x + width / 2, y + height / 2 - 100, { steps: 5 });
      await page.mouse.up();

      await expect(content).toBeVisible();
      await expect(collapsedHandle).toHaveAttribute("aria-expanded", "true");
    });
  });
});
