import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/sheet-bottom is a Section with data-testid="sheet-bottom-<caseId>" holding
// one SheetBottom: modal (the "Share" sheet and its "Open bottom sheet" button), modal-scrolling
// (the tall "Terms" sheet and its "Open tall bottom sheet" button), standard ("Now playing", the
// last child of a scrolling region) and collapsed ("Map layers", starting collapsed, with French
// dragHandleLabels).
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

// A mouse drag of dy pixels, straight up (negative) or down, from (x, y)
async function drag(page: Page, x: number, y: number, dy: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 5 });
  await page.mouse.up();
}

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
      await open(page);
      // at half height, the full-height close button is hidden, so the handle is the one Close
      const header = sheet(page).locator("header");
      await expect(header.getByRole("button", { name: "Close" })).toHaveCount(
        1
      );
      await expect(header.getByRole("heading", { name: "Share" })).toHaveCount(
        1
      );
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

    test("with content taller than half the window, opens at half its height, its handle named Drag handle", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 400, height: 600 });
      const tall = modalSheet(page, "modal-scrolling");
      await opener(page, "modal-scrolling").click();

      await expect.poll(async () => (await box(tall)).y).toBe(300);
      const handle = tall.getByRole("button", {
        name: "Drag handle",
        exact: true,
      });
      await expect(handle).toHaveAttribute("aria-expanded", "false");
    });

    test("in a window up to 640px wide, Enter on its handle expands it, full width, to a 72px top margin, and Enter again returns it to half", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 400, height: 600 });
      const tall = modalSheet(page, "modal-scrolling");
      await opener(page, "modal-scrolling").click();
      await expect.poll(async () => (await box(tall)).y).toBe(300);

      await tall
        .getByRole("button", { name: "Drag handle", exact: true })
        .press("Enter");
      await expect.poll(async () => (await box(tall)).y).toBe(72);
      const { x, width } = await box(tall);
      expect(x).toBe(0);
      expect(width).toBe(await viewportWidth(page));
      const handle = tall.getByRole("button", {
        name: "Drag handle",
        exact: true,
      });
      await expect(handle).toHaveAttribute("aria-expanded", "true");

      await handle.press("Enter");
      await expect.poll(async () => (await box(tall)).y).toBe(300);
      expect(await isOpen(tall)).toBe(true);
    });

    test("is at most 640px wide, centred, with a 56px top margin when expanded, in a wider window", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1000, height: 800 });
      const tall = modalSheet(page, "modal-scrolling");
      await opener(page, "modal-scrolling").click();

      await tall
        .getByRole("button", { name: "Drag handle", exact: true })
        .press("Enter");
      await expect.poll(async () => (await box(tall)).y).toBe(56);
      const { x, width } = await box(tall);
      expect(width).toBe(640);
      expect(x).toBe(((await viewportWidth(page)) - 640) / 2);
    });

    test("expands on a drag up on its handle; a drag down returns it to half, and another closes it", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 400, height: 600 });
      const tall = modalSheet(page, "modal-scrolling");
      await opener(page, "modal-scrolling").click();
      await expect.poll(async () => (await box(tall)).y).toBe(300);
      // on the handle, halfway across the sheet
      const dragHandle = async (dy: number) => {
        const { x, y } = await box(tall);
        await drag(page, x + 200, y + 24, dy);
      };

      await dragHandle(-100);
      await expect.poll(async () => (await box(tall)).y).toBe(72);
      await dragHandle(100);
      await expect.poll(async () => (await box(tall)).y).toBe(300);
      await dragHandle(100);
      await expect.poll(() => isOpen(tall)).toBe(false);
    });

    test("shows a close button only at full height, which cancels it like Escape", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 400, height: 600 });
      const tall = modalSheet(page, "modal-scrolling");
      await opener(page, "modal-scrolling").click();
      const close = tall.getByRole("button", { name: "Close", exact: true });
      await expect(close).toBeHidden();

      await tall
        .getByRole("button", { name: "Drag handle", exact: true })
        .press("Enter");
      await expect(close).toBeVisible();
      await recordEvents(tall);
      await close.click();

      await expect.poll(() => isOpen(tall)).toBe(false);
      expect(await recordedEvents(tall)).toEqual(["cancel", "close:"]);
    });

    test("opens at half height again after closing at full height", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 400, height: 600 });
      const tall = modalSheet(page, "modal-scrolling");
      await opener(page, "modal-scrolling").click();
      await tall
        .getByRole("button", { name: "Drag handle", exact: true })
        .press("Enter");
      await expect.poll(async () => (await box(tall)).y).toBe(72);
      await page.keyboard.press("Escape");
      await expect.poll(() => isOpen(tall)).toBe(false);

      await opener(page, "modal-scrolling").click();
      await expect.poll(async () => (await box(tall)).y).toBe(300);
    });

    test("gains its full height when its content grows past half the window while it's open", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 400, height: 600 });
      await open(page);
      await expect(
        sheet(page).getByRole("button", { name: "Close", exact: true })
      ).toBeVisible();
      const grow = (height: string) =>
        sheet(page)
          .locator("p")
          .evaluate((p, h) => (p.style.height = h), height);

      await grow("150px");
      await expect(
        sheet(page).getByRole("button", { name: "Close", exact: true })
      ).toBeVisible();
      await grow("400px");
      await expect(
        sheet(page).getByRole("button", { name: "Drag handle", exact: true })
      ).toHaveAttribute("aria-expanded", "false");
    });

    test("with content that fits, has one height: its handle, labelled Close, closes it", async ({
      page,
    }) => {
      await open(page);
      const handle = sheet(page).getByRole("button", {
        name: "Close",
        exact: true,
      });
      await expect(handle).not.toHaveAttribute("aria-expanded");

      await handle.click();
      await expect.poll(() => isOpen(sheet(page))).toBe(false);
    });

    test("its whole top 48px is the handle's target: a drag down from near its top-left corner closes it", async ({
      page,
    }) => {
      await open(page);
      const { x, y, width } = await box(sheet(page));
      const handleBox = await box(
        sheet(page).getByRole("button", { name: "Close", exact: true })
      );
      expect(handleBox).toMatchObject({ x, y, width, height: 48 });

      // just inside the 28px corner's curve, which clips the sheet
      await drag(page, x + 24, y + 12, 100);
      await expect.poll(() => isOpen(sheet(page))).toBe(false);
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
      await drag(page, x + width / 2, y + height / 2, 100);
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
      sheet(page).getByRole("button", { name: "Drag handle", exact: true });

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
        header.getByRole("button", { name: "Drag handle", exact: true })
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
      // its name stays put, and aria-expanded carries the state
      await expect(handle(page)).toHaveAccessibleName("Drag handle");
      await expect(sheet(page).getByRole("heading")).toBeVisible();

      await handle(page).press("Enter");
      await expect(content).toBeVisible();
    });

    test("a drag down from near its top-left corner collapses it", async ({
      page,
    }) => {
      const content = sheet(page).getByText("Details about the item");
      await sheet(page).scrollIntoViewIfNeeded();
      // it's at the window's bottom edge, so a short drag, which stays in the window
      const { x, y } = await box(sheet(page));
      // just inside the 28px corner's curve, which clips the sheet
      await drag(page, x + 24, y + 12, 60);

      await expect(content).toBeHidden();
    });

    test("a collapsed sheet expands on a drag up on its handle, labelled by dragHandleLabels", async ({
      page,
    }) => {
      const collapsed = sheetCase(page, "collapsed").getByRole(
        "complementary",
        { name: "Map layers" }
      );
      // this case passes French labels
      const collapsedHandle = collapsed.getByRole("button", {
        name: "Poignée de déplacement",
      });
      const content = collapsed.getByText(
        "Controls for the layers of the map."
      );
      await expect(content).toBeHidden();

      await collapsedHandle.scrollIntoViewIfNeeded();
      const { x, y, width, height } = await box(collapsedHandle);
      await drag(page, x + width / 2, y + height / 2, -100);

      await expect(content).toBeVisible();
      await expect(collapsedHandle).toHaveAttribute("aria-expanded", "true");
    });
  });
});
