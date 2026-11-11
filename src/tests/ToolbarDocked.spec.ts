import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  castsNoShadow,
  expectFocusRing,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/toolbar-docked is a Section with data-testid="toolbar-docked-<caseId>"
type ToolbarDockedCaseId =
  | "anatomy"
  | "few"
  | "vibrant"
  | "primary-action"
  | "selected"
  | "controls"
  | "pinned"
  | "rtl";

const section = (page: Page, caseId: ToolbarDockedCaseId) =>
  page.getByTestId(`toolbar-docked-${caseId}`);
const toolbar = (page: Page, caseId: ToolbarDockedCaseId, name?: string) =>
  section(page, caseId).getByRole("toolbar", name ? { name } : undefined);
const button = (target: Locator, name: string) =>
  target.getByRole("button", { name, exact: true });

const role = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

const center = ({ x, width }: { x: number; width: number }) => x + width / 2;
const centers = async (buttons: Locator[]) =>
  Promise.all(buttons.map(async (b) => center(await box(b))));

// A compact window (below M3's medium, 600px) and an expanded one
const COMPACT = { width: 412, height: 900 };
const EXPANDED = { width: 1280, height: 900 };

test.describe("ToolbarDocked", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/toolbar-docked");
  });

  // M3's Accessibility page: on web, the container has the toolbar role
  test("is a toolbar named by its aria-label", async ({ page }) => {
    await expect(toolbar(page, "anatomy", "Message actions")).toBeVisible();
    await expect(toolbar(page, "anatomy")).not.toHaveAttribute(
      "aria-orientation",
      "vertical"
    );
  });

  // M3's Specs: 64dp high, spanning its container, straight corners and no shadow
  test("is 64px high, spans its container, with square corners and no shadow", async ({
    page,
  }) => {
    const bar = toolbar(page, "anatomy");
    const outer = await box(bar);
    const parent = await box(section(page, "anatomy"));
    expect(outer.height).toBe(64);
    expect(outer.width).toBeCloseTo(parent.width - 32, 0);
    await expect(bar).toHaveCSS("border-top-left-radius", "0px");
    await expect(bar).toHaveCSS("border-bottom-right-radius", "0px");
    expect(await castsNoShadow(bar)).toBe(true);

    // its buttons centered in its height
    for (const name of ["Back", "More"]) {
      const b = await box(button(bar, name));
      expect(b.y + b.height / 2 - outer.y).toBeCloseTo(32, 0);
    }
  });

  // M3's Guidelines: in compact windows, its items are evenly spaced, 16dp in from each edge.
  // Each icon button is laid out in its 48dp target, as in Compose, so a 40px button's center is
  // 16 + 24 = 40px in.
  test("in a compact window, spreads its items evenly, 16px from each edge", async ({
    page,
  }) => {
    await page.setViewportSize(COMPACT);
    for (const caseId of ["anatomy", "few"] as const) {
      const bar = toolbar(page, caseId);
      const outer = await box(bar);
      const buttons = await bar.getByRole("button").all();
      const xs = await centers(buttons);
      expect(xs[0]! - outer.x).toBeCloseTo(40, 0);
      expect(outer.x + outer.width - xs.at(-1)!).toBeCloseTo(40, 0);
      const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
      for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 0);
    }
  });

  // M3's Guidelines: in medium windows and larger, it centers its items; Compose's fixed
  // arrangement keeps the token's 32dp max spacing between their 48dp targets
  test("in a medium window or larger, centers its items 32px apart", async ({
    page,
  }) => {
    await page.setViewportSize(EXPANDED);
    const bar = toolbar(page, "few");
    const outer = await box(bar);
    const xs = await centers(await bar.getByRole("button").all());
    expect(xs[1]! - xs[0]!).toBeCloseTo(48 + 32, 0);
    expect(xs[2]! - xs[1]!).toBeCloseTo(48 + 32, 0);
    expect((xs[0]! + xs[2]!) / 2).toBeCloseTo(center(outer), 0);
  });

  // M3's Specs, color: standard is surface container, its icon buttons on-surface-variant;
  // vibrant is primary container, its icon buttons on-primary-container. A filled icon button
  // keeps primary and on-primary.
  test("takes M3's color roles, standard and vibrant, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);

      const standard = toolbar(page, "anatomy");
      await expect(standard).toHaveCSS(
        "background-color",
        await role(page, "surface-container")
      );
      await expect(button(standard, "Archive")).toHaveCSS(
        "color",
        await role(page, "on-surface-variant")
      );

      const vibrant = toolbar(page, "vibrant");
      await expect(vibrant).toHaveCSS(
        "background-color",
        await role(page, "primary-container")
      );
      await expect(button(vibrant, "Edit")).toHaveCSS(
        "color",
        await role(page, "on-primary-container")
      );
      const add = button(vibrant, "Add");
      await expect(add).toHaveCSS(
        "background-color",
        await role(page, "primary")
      );
      await expect(add).toHaveCSS("color", await role(page, "on-primary"));
    }
  });

  // M3's Specs: a selected button is secondary container with on-secondary-container in a
  // standard toolbar, surface container with on-surface in a vibrant one. Unselected, it takes
  // the toolbar's own container and icon colors.
  test("draws a selected toggle in the toolbar's selected colors, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      for (const [name, rest, onRest, selected, onSelected] of [
        [
          "Standard toggles",
          "surface-container",
          "on-surface-variant",
          "secondary-container",
          "on-secondary-container",
        ],
        [
          "Vibrant toggles",
          "primary-container",
          "on-primary-container",
          "surface-container",
          "on-surface",
        ],
      ] as const) {
        const bar = toolbar(page, "selected", name);
        const on = button(bar, "Favorite");
        const off = button(bar, "Bookmark");
        await expect(on).toHaveAttribute("aria-pressed", "true");
        await expect(on).toHaveCSS(
          "background-color",
          await role(page, selected)
        );
        await expect(on).toHaveCSS("color", await role(page, onSelected));
        await expect(off).toHaveCSS("background-color", await role(page, rest));
        await expect(off).toHaveCSS("color", await role(page, onRest));
      }
    }
  });

  test("selects a toggle on click", async ({ page }) => {
    const bar = toolbar(page, "selected", "Standard toggles");
    const star = button(bar, "Star");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await expect(star).toHaveCSS(
      "background-color",
      await role(page, "secondary-container")
    );
  });

  // M3's Accessibility page: Tab or the arrow keys move between its controls, and focus lands
  // on the first one
  test("moves between its controls with Tab and the arrow keys, stopping at the ends", async ({
    page,
  }) => {
    const bar = toolbar(page, "anatomy");
    await button(bar, "Back").focus();
    await page.keyboard.press("Tab");
    await expect(button(bar, "Archive")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(bar, "Delete")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(button(bar, "Back")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(button(bar, "Back")).toBeFocused();
    await button(bar, "More").focus();
    await page.keyboard.press("ArrowRight");
    await expect(button(bar, "More")).toBeFocused();
  });

  test("the arrow keys go into and out of a button group, skip a disabled button, and leave a text field's caret alone", async ({
    page,
  }) => {
    const bar = toolbar(page, "controls");
    await button(bar, "Reply").focus();
    await page.keyboard.press("ArrowRight");
    await expect(button(bar, "Copy")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(bar, "Copy link")).toBeFocused();
    // past the disabled Download, to the text field
    await page.keyboard.press("ArrowRight");
    const find = bar.getByRole("textbox", { name: "Find" });
    await expect(find).toBeFocused();
    await find.fill("abc");
    await page.keyboard.press("ArrowLeft");
    await expect(find).toBeFocused();
    expect(
      await find.evaluate((el: HTMLInputElement) => el.selectionStart)
    ).toBe(2);
    // Tab leaves it
    await page.keyboard.press("Tab");
    await expect(button(bar, "Search")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(find).toBeFocused();
  });

  test("shows a focus ring on a focused control", async ({ page }) => {
    for (const caseId of ["anatomy", "vibrant"] as const) {
      const bar = toolbar(page, caseId);
      const first = bar.getByRole("button").first();
      await first.focus();
      await page.keyboard.press("ArrowRight");
      await expectFocusRing(bar.getByRole("button").nth(1));
    }
  });

  // M3's Guidelines: a primary action can be embedded in the toolbar, here a wide filled icon
  // button among standard ones, spaced like them
  test("holds an embedded primary action, spaced like its other items", async ({
    page,
  }) => {
    await page.setViewportSize(COMPACT);
    const bar = toolbar(page, "primary-action");
    const send = button(bar, "Send");
    await expect(send).toHaveCSS(
      "background-color",
      await role(page, "primary")
    );
    expect((await box(send)).width).toBe(52);
    const outer = await box(bar);
    const buttons = await bar.getByRole("button").all();
    const boxes = await Promise.all(buttons.map(box));
    // the space between each target and the next is the same, a target being 48px or the
    // button's own width where it's wider
    const target = (b: { x: number; width: number }) => {
      const width = Math.max(48, b.width);
      return { start: center(b) - width / 2, end: center(b) + width / 2 };
    };
    const spaces = boxes
      .slice(1)
      .map((b, i) => target(b).start - target(boxes[i]!).end);
    for (const space of spaces) expect(space).toBeCloseTo(spaces[0]!, 0);
    expect(target(boxes[0]!).start - outer.x).toBeCloseTo(16, 0);
  });

  test("stays at the bottom of a scrolling box when pinned there", async ({
    page,
  }) => {
    const region = section(page, "pinned").getByRole("region", {
      name: "Message",
    });
    await region.evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
    const bar = await box(toolbar(page, "pinned"));
    const view = await box(region);
    expect(bar.y + bar.height).toBeCloseTo(view.y + view.height - 1, 0);
  });

  // M3's Guidelines: right to left, the order of the actions flips, and so do the arrow keys
  test("mirrors right to left, the arrow keys too", async ({ page }) => {
    await page.setViewportSize(COMPACT);
    const bar = toolbar(page, "rtl");
    const outer = await box(bar);
    const back = button(bar, "رجوع");
    const archive = button(bar, "أرشفة");
    expect(outer.x + outer.width - center(await box(back))).toBeCloseTo(40, 0);
    expect(center(await box(archive))).toBeLessThan(center(await box(back)));
    await back.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(archive).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(back).toBeFocused();
  });
});
