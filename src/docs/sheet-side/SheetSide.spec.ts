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

test.describe("SheetSide", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/sheet-side");
  });

  test.describe("modal", () => {
    // the usage example: docked on the end edge, headline "Details"
    const sheet = (page: Page) => page.locator("#sheet-side-usage");

    test("opens from its button as a dialog named by its headline, 256px wide on the end edge", async ({
      page,
    }) => {
      await expect(sheet(page)).toBeHidden();
      await opener(page, "Open side sheet").click();

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

    test("uses M3's surface, headline type and inner-edge corners", async ({
      page,
    }) => {
      await opener(page, "Open side sheet").click();
      const surface = sheet(page).locator("> *");
      const headline = sheet(page).getByRole("heading", { name: "Details" });

      await expect(surface).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface-container-low)")
      );
      await expect(surface).toHaveCSS("border-top-left-radius", "16px");
      await expect(surface).toHaveCSS("border-top-right-radius", "0px");
      await expect(headline).toHaveCSS("font-size", "22px");
      await expect(headline).toHaveCSS("line-height", "28px");
      await expect(headline).toHaveCSS("font-weight", "400");
      // browsers report a letter-spacing of 0 as "normal"
      await expect(headline).toHaveCSS("letter-spacing", /^(normal|0px)$/);
    });

    test("closes with its close button, Escape or a click on the scrim", async ({
      page,
    }) => {
      const open = async () => {
        await opener(page, "Open side sheet").click();
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

    test("a start sheet sits on the start edge", async ({ page }) => {
      const start = page.locator("#sheet-side-start");

      await opener(page, "Open start side sheet").click();
      await expect.poll(async () => (await box(start)).x).toBe(0);
    });

    test("a detached sheet is 16px from the window's edges, rounded all round, with its actions in M3's row", async ({
      page,
    }) => {
      const detached = page.locator("#sheet-side-detached");
      await opener(page, "Open detached side sheet").click();

      await expect
        .poll(async () => {
          const { x, width } = await box(detached);
          return x + width;
        })
        .toBe((await viewportWidth(page)) - 16);
      const { y, height } = await box(detached);
      expect(y).toBe(16);
      expect(height).toBe(page.viewportSize()!.height - 32);
      await expect(detached.locator("> *")).toHaveCSS(
        "border-top-right-radius",
        "16px"
      );

      const actions = detached
        .getByRole("button", { name: "Save" })
        .locator("..");
      await expect(actions).toHaveCSS("padding-top", "16px");
      await expect(actions).toHaveCSS("padding-bottom", "24px");
      await expect(actions).toHaveCSS("justify-content", "flex-start");
      expect((await box(actions)).height).toBeGreaterThanOrEqual(72);
    });
  });

  test.describe("standard", () => {
    // example-01: in a flex row, beside the main content
    const sheet = (page: Page) =>
      page
        .getByTestId("code-preview")
        .getByRole("complementary", { name: "Filters" });

    test("is an aside beside the content, 256px wide on M3's surface with a divider on its inner edge", async ({
      page,
    }) => {
      await expect(sheet(page)).toBeVisible();
      expect((await box(sheet(page))).width).toBe(256);
      await expect(sheet(page)).toHaveCSS("border-top-width", "0px");
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

    test("its close button hides it", async ({ page }) => {
      await sheet(page).getByRole("button", { name: "Close" }).click();
      await expect(sheet(page)).toBeHidden();
    });
  });
});

// The docs site's table of contents is a SheetSide: standard and docked from large up, modal
// behind a button below it
test.describe("SheetSide as the table of contents", () => {
  const docked = (page: Page) =>
    page.getByRole("complementary", { name: "On this page" });
  const modal = (page: Page) => page.locator("#table-of-contents");
  const tocButton = (page: Page) =>
    page.getByRole("button", { name: "Show table of contents" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/components/button");
  });

  test("from large up, it's docked flush to the window's end edge", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const { x, width } = await box(docked(page));

    expect(x + width).toBe(await viewportWidth(page));
    await expect(tocButton(page)).toBeHidden();
  });

  test("below large, its button opens it as a modal, and following a link closes it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 800 });
    await expect(docked(page)).toBeHidden();

    await tocButton(page).click();
    await expect.poll(() => isOpen(modal(page))).toBe(true);
    await modal(page).getByRole("link", { name: "Properties" }).click();

    await expect.poll(() => isOpen(modal(page))).toBe(false);
    await expect(page).toHaveURL(/#properties$/);
  });
});
