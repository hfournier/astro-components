import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  css,
  elevation,
  expectFocusRing,
  radii,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/toolbar-floating is a Section with data-testid="toolbar-floating-<caseId>"
type ToolbarFloatingCaseId =
  | "anatomy"
  | "vibrant"
  | "vertical"
  | "selected"
  | "fab"
  | "exit"
  | "stays"
  | "rtl";

const section = (page: Page, caseId: ToolbarFloatingCaseId) =>
  page.getByTestId(`toolbar-floating-${caseId}`);
const toolbar = (page: Page, caseId: ToolbarFloatingCaseId, name?: string) =>
  section(page, caseId).getByRole(
    "toolbar",
    name ? { name, exact: true } : undefined
  );
const button = (target: Locator, name: string) =>
  target.getByRole("button", { name, exact: true });

const role = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

type Box = { x: number; y: number; width: number; height: number };
const centerX = ({ x, width }: Box) => x + width / 2;
const centerY = ({ y, height }: Box) => y + height / 2;
const boxes = async (target: Locator) =>
  Promise.all((await target.getByRole("button").all()).map(box));

// Waits until an element has stopped moving, such as a toolbar leaving or returning on scroll
const stopped = async (target: Locator) => {
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify(await box(target));
      const same = now === last;
      last = now;
      return same;
    })
    .toBe(true);
  return box(target);
};

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

test.describe("ToolbarFloating", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/toolbar-floating");
  });

  // M3's Accessibility page: on web, the container has the toolbar role. A horizontal one keeps
  // ARIA's default orientation; a vertical one says so, so assistive technology names its keys.
  test("is a toolbar named by its aria-label, vertical ones marked so", async ({
    page,
  }) => {
    await expect(toolbar(page, "anatomy", "Message actions")).toBeVisible();
    await expect(toolbar(page, "anatomy")).not.toHaveAttribute(
      "aria-orientation",
      /./
    );
    await expect(toolbar(page, "vertical", "Drawing tools")).toHaveAttribute(
      "aria-orientation",
      "vertical"
    );
  });

  // M3's Specs: 64dp high, fully rounded, elevation level 3, 8dp leading and trailing space and 4dp
  // between items. Each icon button sits in its 48dp target, so a 40px button's center is 8 + 24
  // = 32px in, and the next one 48 + 4 = 52px on. It's only as wide as its items.
  test("is 64px high, fully rounded and raised, only as wide as its items", async ({
    page,
  }) => {
    const bar = toolbar(page, "anatomy");
    const outer = await box(bar);
    expect(outer.height).toBe(64);
    expect(outer.width).toBeCloseTo(8 + 5 * 48 + 4 * 4 + 8, 0);
    // fully rounded: a radius of at least half its 64px
    for (const radius of await radii(bar))
      expect(parseFloat(radius)).toBeGreaterThanOrEqual(32);
    expect(await css(bar, "box-shadow")).toContain(await elevation(page, 3));

    const xs = (await boxes(bar)).map(centerX);
    expect(xs[0]! - outer.x).toBeCloseTo(32, 0);
    for (let i = 1; i < xs.length; i++)
      expect(xs[i]! - xs[i - 1]!).toBeCloseTo(52, 0);
    for (const b of await boxes(bar))
      expect(centerY(b) - outer.y).toBeCloseTo(32, 0);
  });

  // M3's Specs: a vertical toolbar is 64dp wide, with the same spaces down its length
  test("vertical, is 64px wide with its items in a column", async ({
    page,
  }) => {
    const bar = toolbar(page, "vertical", "Drawing tools");
    const outer = await box(bar);
    expect(outer.width).toBe(64);
    expect(outer.height).toBeCloseTo(8 + 3 * 48 + 2 * 4 + 8, 0);
    // fully rounded: a radius of at least half its 64px
    for (const radius of await radii(bar))
      expect(parseFloat(radius)).toBeGreaterThanOrEqual(32);
    const items = await boxes(bar);
    expect(centerY(items[0]!) - outer.y).toBeCloseTo(32, 0);
    for (let i = 1; i < items.length; i++)
      expect(centerY(items[i]!) - centerY(items[i - 1]!)).toBeCloseTo(52, 0);
    for (const b of items) expect(centerX(b) - outer.x).toBeCloseTo(32, 0);
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
      for (const [bar, name] of [
        [toolbar(page, "anatomy"), "Archive"],
        [toolbar(page, "vertical", "Drawing tools"), "Draw"],
      ] as const) {
        await expect(bar).toHaveCSS(
          "background-color",
          await role(page, "surface-container")
        );
        await expect(button(bar, name)).toHaveCSS(
          "color",
          await role(page, "on-surface-variant")
        );
      }
      for (const [bar, name] of [
        [toolbar(page, "vibrant"), "Edit"],
        [toolbar(page, "vertical", "Vibrant drawing tools"), "Draw"],
      ] as const) {
        await expect(bar).toHaveCSS(
          "background-color",
          await role(page, "primary-container")
        );
        await expect(button(bar, name)).toHaveCSS(
          "color",
          await role(page, "on-primary-container")
        );
      }
      const add = button(toolbar(page, "vibrant"), "Add");
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

  // M3's Specs: the FAB is 56dp, corner large (16dp), elevation level 1, 8dp from the toolbar;
  // secondary container in a standard toolbar, tertiary container in a vibrant one. Compose puts
  // it at the end of a horizontal toolbar, centered on it, and below a vertical one.
  test("pairs with a FAB 8px after it, centered on it", async ({ page }) => {
    const fabs = section(page, "fab");
    // each toolbar's FAB, in the same order
    for (const [index, name, vertical] of [
      [0, "Photo actions", false],
      [1, "Vibrant photo actions", false],
      [2, "Vertical photo actions", true],
    ] as const) {
      const bar = await box(toolbar(page, "fab", name));
      const fab = await box(
        fabs.getByRole("button", { name: "Edit photo" }).nth(index)
      );
      expect(fab.width).toBe(56);
      expect(fab.height).toBe(56);
      if (vertical) {
        expect(fab.y - (bar.y + bar.height)).toBeCloseTo(8, 0);
        expect(centerX(fab)).toBeCloseTo(centerX(bar), 0);
      } else {
        expect(fab.x - (bar.x + bar.width)).toBeCloseTo(8, 0);
        expect(centerY(fab)).toBeCloseTo(centerY(bar), 0);
      }
    }
  });

  test("draws its FAB in M3's colors and elevation for the toolbar, in light and dark", async ({
    page,
  }) => {
    const fabs = section(page, "fab").getByRole("button", {
      name: "Edit photo",
    });
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      for (const [index, container, onContainer] of [
        [0, "secondary-container", "on-secondary-container"],
        [1, "tertiary-container", "on-tertiary-container"],
      ] as const) {
        const fab = fabs.nth(index);
        await expect(fab).toHaveCSS(
          "background-color",
          await role(page, container)
        );
        await expect(fab).toHaveCSS("color", await role(page, onContainer));
        for (const radius of await radii(fab)) expect(radius).toBe("16px");
        // after the empty ring shadows Tailwind puts first
        expect(await css(fab, "box-shadow")).toContain(
          await elevation(page, 1)
        );
      }
    }
  });

  // M3's Accessibility page: Tab or the arrow keys move between its controls. The FAB is its own
  // component beside the toolbar (M3: "on other platforms, each component needs to be added
  // separately"), so Tab reaches it and the toolbar's arrow keys stop before it.
  test("moves between its controls with Tab and the arrow keys, the FAB by Tab", async ({
    page,
  }) => {
    const bar = toolbar(page, "fab", "Photo actions");
    await button(bar, "Share").focus();
    await page.keyboard.press("ArrowRight");
    await expect(button(bar, "Favorite")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(button(bar, "Delete")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(button(bar, "Favorite")).toBeFocused();
    await button(bar, "Delete").focus();
    await page.keyboard.press("Tab");
    await expect(
      section(page, "fab").getByRole("button", { name: "Edit photo" }).first()
    ).toBeFocused();
  });

  // A vertical toolbar moves with the up and down arrows, as ARIA's vertical toolbar does
  test("vertical, the up and down arrows move between its controls", async ({
    page,
  }) => {
    const bar = toolbar(page, "vertical", "Drawing tools");
    await button(bar, "Draw").focus();
    await page.keyboard.press("ArrowRight");
    await expect(button(bar, "Draw")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(button(bar, "Insert image")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(button(bar, "Insert link")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(button(bar, "Insert image")).toBeFocused();
  });

  test("shows a focus ring on a focused control", async ({ page }) => {
    for (const caseId of ["anatomy", "vibrant"] as const) {
      const bar = toolbar(page, caseId);
      await bar.getByRole("button").first().focus();
      await page.keyboard.press("ArrowRight");
      await expectFocusRing(bar.getByRole("button").nth(1));
    }
  });

  // M3's Guidelines: floating toolbars can animate off screen as the content scrolls, and
  // Compose's exit-always behavior brings them back as soon as it scrolls back. A horizontal one
  // at the bottom leaves downward, a vertical one at the end leaves toward it, with its FAB.
  test("with exit-always, leaves as the content scrolls down and returns as it scrolls up", async ({
    page,
  }) => {
    const region = section(page, "exit").getByRole("region", {
      name: "Article",
    });
    const view = await box(region);
    const reading = toolbar(page, "exit", "Reading");
    const side = toolbar(page, "exit", "Side tools");
    const comment = section(page, "exit").getByRole("button", {
      name: "Comment",
    });
    const restReading = await stopped(reading);
    const restSide = await stopped(side);
    expect(overlaps(restReading, view)).toBe(true);

    await region.evaluate((el) => el.scrollBy(0, 120));
    const goneReading = await stopped(reading);
    const goneSide = await stopped(side);
    const goneComment = await stopped(comment);
    expect(goneReading.y).toBeGreaterThan(view.y + view.height);
    expect(goneComment.y).toBeGreaterThan(view.y + view.height);
    expect(goneSide.x).toBeGreaterThan(view.x + view.width);

    await region.evaluate((el) => el.scrollBy(0, -40));
    expect(await stopped(reading)).toEqual(restReading);
    expect(await stopped(side)).toEqual(restSide);
  });

  // M3's Accessibility page: people keep access to the toolbar's controls while the content is
  // scrolled. Tabbing to a control of a toolbar that has left brings it back.
  test("with exit-always, comes back when a control takes focus", async ({
    page,
  }) => {
    const region = section(page, "exit").getByRole("region", {
      name: "Article",
    });
    const reading = toolbar(page, "exit", "Reading");
    // where it sits in the box's view, as focusing it can scroll the page
    const inView = async () => {
      const bar = await stopped(reading);
      const view = await box(region);
      return { x: bar.x - view.x, y: bar.y - view.y };
    };
    const rest = await inView();
    await region.evaluate((el) => el.scrollBy(0, 120));
    await stopped(reading);
    await button(reading, "Share").focus();
    expect(await inView()).toEqual(rest);
    // and stays while focus is in it, even as the content scrolls on
    await region.evaluate((el) => el.scrollBy(0, 40));
    expect(await inView()).toEqual(rest);
  });

  test("without a scroll behavior, stays while the content scrolls", async ({
    page,
  }) => {
    const region = section(page, "stays").getByRole("region", {
      name: "Notes",
    });
    const bar = toolbar(page, "stays");
    const view = await box(region);
    await region.evaluate((el) => el.scrollBy(0, 120));
    const after = await stopped(bar);
    expect(after.y + after.height).toBeCloseTo(
      view.y + view.height - 1 - 16,
      0
    );
  });

  // Compose's floating toolbar animation spec: it moves on M3's fast spatial spring, and with
  // reduced motion it leaves and returns at once
  test("leaves on the fast spatial spring, at once with reduced motion", async ({
    page,
  }) => {
    const root = section(page, "exit").locator(
      "[data-ac-toolbar-floating-part=root]",
      { has: page.getByRole("toolbar", { name: "Reading" }) }
    );
    await expect(root).toHaveCSS(
      "transition-duration",
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--theme-duration-spring-fast-spatial")
          .trim()
          .replace(/^(\d+)ms$/, (_, ms) => `${Number(ms) / 1000}s`)
      )
    );
    await expect(root).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.42, 1.67, 0.21, 0.9)"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(root).toHaveCSS("transition-duration", "0s");
  });

  // M3's Guidelines: right to left, the order of the actions flips, the FAB at the left, and so
  // do the arrow keys
  test("mirrors right to left, its FAB and the arrow keys too", async ({
    page,
  }) => {
    const bar = toolbar(page, "rtl");
    const outer = await box(bar);
    const share = button(bar, "مشاركة");
    const favorite = button(bar, "تفضيل");
    expect(outer.x + outer.width - centerX(await box(share))).toBeCloseTo(
      32,
      0
    );
    expect(centerX(await box(favorite))).toBeLessThan(
      centerX(await box(share))
    );
    const fab = await box(
      section(page, "rtl").getByRole("button", { name: "تحرير" })
    );
    expect(outer.x - (fab.x + fab.width)).toBeCloseTo(8, 0);
    await share.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(favorite).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(share).toBeFocused();
  });
});
