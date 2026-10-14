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

const opener = (page: Page, name: string) =>
  page.getByTestId("code-preview").getByRole("button", { name, exact: true });
const box = async (target: Locator) => (await target.boundingBox())!;
const viewportWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.clientWidth);
const isOpen = (sheet: Locator) =>
  sheet.evaluate((el) => (el as HTMLDialogElement).open);

test.describe("SheetBottom", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/sheet-bottom");
  });

  test.describe("modal", () => {
    // the usage example: headline "Share"
    const sheet = (page: Page) => page.locator("#sheet-bottom-usage");
    const open = async (page: Page) => {
      await opener(page, "Open bottom sheet").click();
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

    test("uses M3's surface, top corners, headline type and drag handle", async ({
      page,
    }) => {
      await open(page);
      const surface = sheet(page).locator("> *");
      const headline = sheet(page).getByRole("heading", { name: "Share" });
      const handle = sheet(page).getByRole("button", { name: "Close" });

      await expect(surface).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
      await expect(surface).toHaveCSS("border-top-left-radius", "28px");
      await expect(surface).toHaveCSS("border-bottom-left-radius", "0px");
      await expect(headline).toHaveCSS("font-size", "22px");
      await expect(headline).toHaveCSS("line-height", "28px");
      await expect(headline).toHaveCSS("font-weight", "400");

      // a centred 32 x 4px handle with 22px above and below it
      await expect(handle).toHaveCSS("padding-top", "22px");
      await expect(handle).toHaveCSS("padding-bottom", "22px");
      const bar = await box(handle.locator("> *"));
      const sheetBox = await box(sheet(page));
      expect(bar.width).toBe(32);
      expect(bar.height).toBe(4);
      expect(bar.y - sheetBox.y).toBe(22);
      expect(bar.x + bar.width / 2).toBeCloseTo(
        sheetBox.x + sheetBox.width / 2,
        0
      );
    });

    test("is full width in a window up to 640px wide, with a 72px top margin", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 400, height: 600 });
      const tall = page.locator("#sheet-bottom-scrolling");
      await opener(page, "Open tall bottom sheet").click();

      await expect.poll(async () => (await box(tall)).y).toBe(72);
      const { x, width } = await box(tall);
      expect(x).toBe(0);
      expect(width).toBe(await viewportWidth(page));
    });

    test("is at most 640px wide, centred, with a 56px top margin, in a wider window", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1000, height: 800 });
      const tall = page.locator("#sheet-bottom-scrolling");
      await opener(page, "Open tall bottom sheet").click();

      await expect.poll(async () => (await box(tall)).y).toBe(56);
      const { x, width } = await box(tall);
      expect(width).toBe(640);
      expect(x).toBe(((await viewportWidth(page)) - 640) / 2);
    });

    test("keeps 56px from the window's start and end edges just past 640px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 700, height: 800 });
      await opener(page, "Open bottom sheet").click();

      await expect.poll(async () => (await box(sheet(page))).x).toBe(56);
      const { x, width } = await box(sheet(page));
      expect(x + width).toBe((await viewportWidth(page)) - 56);
    });

    test("closes with its drag handle, a drag down on it, Escape or a click on the scrim", async ({
      page,
    }) => {
      const handle = sheet(page).getByRole("button", { name: "Close" });

      await open(page);
      await handle.click();
      await expect.poll(() => isOpen(sheet(page))).toBe(false);

      await open(page);
      const { x, y, width, height } = await box(handle);
      await page.mouse.move(x + width / 2, y + height / 2);
      await page.mouse.down();
      await page.mouse.move(x + width / 2, y + height / 2 + 100, { steps: 5 });
      await page.mouse.up();
      await expect.poll(() => isOpen(sheet(page))).toBe(false);

      await open(page);
      await page.keyboard.press("Escape");
      await expect.poll(() => isOpen(sheet(page))).toBe(false);

      await open(page);
      await page.mouse.click(10, 10);
      await expect.poll(() => isOpen(sheet(page))).toBe(false);
    });
  });

  test.describe("standard", () => {
    // example-01: at the bottom of a scrolling region
    const sheet = (page: Page) =>
      page
        .getByTestId("code-preview")
        .getByRole("complementary", { name: "Now playing" });
    const handle = (page: Page) =>
      sheet(page).getByRole("button", { name: "Sheet content" });

    test("is an aside stuck to the bottom of its scrolling region", async ({
      page,
    }) => {
      const region = sheet(page).locator("..");
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page)).toHaveCSS("position", "sticky");
      const regionBox = await box(region);
      const sheetBox = await box(sheet(page));
      // less the region's 1px border
      expect(sheetBox.y + sheetBox.height).toBeCloseTo(
        regionBox.y + regionBox.height - 1,
        0
      );
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
      const collapsed = page
        .getByTestId("code-preview")
        .getByRole("complementary", { name: "Map layers" });
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
