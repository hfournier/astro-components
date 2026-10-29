import type { Locator } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";

// Each component's transitions are on M3's motion system (ADR-0018): component motion on M3
// Expressive's fast spatial and fast effects springs, as M3 publishes them for the web, larger
// motion on the default springs, and an overlay entering or leaving on M3's easing and duration.

// M3's "Web: Convert springs to curves" table (Motion, Specs), as the browser serializes it
const FAST_SPATIAL = "0.35s cubic-bezier(0.42, 1.67, 0.21, 0.9)";
const FAST_EFFECTS = "0.15s cubic-bezier(0.31, 0.94, 0.34, 1)";
const DEFAULT_SPATIAL = "0.5s cubic-bezier(0.38, 1.21, 0.22, 1)";
const DEFAULT_EFFECTS = "0.2s cubic-bezier(0.34, 0.8, 0.34, 1)";
// the standard scheme's, only where M3 names it: the split button's menu icon turning
const STANDARD_FAST_SPATIAL = "0.35s cubic-bezier(0.27, 1.06, 0.18, 1)";
// M3's suggested easing and duration pairs (Easing and duration, Applying)
const ENTER = "0.4s cubic-bezier(0.05, 0.7, 0.1, 1)"; // emphasized decelerate
const EXIT = "0.2s cubic-bezier(0.3, 0, 0.8, 0.15)"; // emphasized accelerate
const STANDARD = "0.3s cubic-bezier(0.2, 0, 0, 1)"; // emphasized's web fallback

/** Each transitioned property's duration and timing function, as `"<duration> <easing>"`. */
const transitionOf = (target: Locator, pseudo?: string) =>
  target.evaluate((el, pseudoElement) => {
    const style = getComputedStyle(el, pseudoElement);
    // split on the commas between list items, not those inside cubic-bezier()
    const list = (value: string) =>
      value.split(/,(?![^(]*\))/).map((item) => item.trim());
    const durations = list(style.transitionDuration);
    const easings = list(style.transitionTimingFunction);
    return Object.fromEntries(
      list(style.transitionProperty).map((property, i) => [
        property,
        // CSS repeats the shorter lists to match the property list
        `${durations[i % durations.length]} ${easings[i % easings.length]}`,
      ])
    );
  }, pseudo);

const expectTransitions = async (
  target: Locator,
  expected: Record<string, string>,
  pseudo?: string
) => expect.poll(() => transitionOf(target, pseudo)).toMatchObject(expected);

test.describe("motion", () => {
  test("ADR-0006's pre-M3 tokens are gone", async ({ page }) => {
    await page.goto("/tests/button");
    const defined = await page.evaluate(() =>
      [
        "--theme-duration-fast",
        "--theme-duration-base",
        "--theme-duration-slow",
        "--theme-duration-feedback",
        "--theme-duration-overlay",
        "--theme-duration-content-swap",
        "--ease-theme-overlay",
      ].filter((token) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue(token)
          .trim()
      )
    );
    expect(defined).toEqual([]);
  });

  test("Button: colors and shadow on fast effects, corners on fast spatial, its state layer on fast effects", async ({
    page,
  }) => {
    await page.goto("/tests/button");
    const button = page
      .getByTestId("button-no-props")
      .getByRole("button")
      .first();
    await expectTransitions(button, {
      color: FAST_EFFECTS,
      "background-color": FAST_EFFECTS,
      "border-color": FAST_EFFECTS,
      "box-shadow": FAST_EFFECTS,
      "border-radius": FAST_SPATIAL,
    });
    // the state layer names no timing, so it shows Tailwind's default is fast effects
    await expectTransitions(button, { opacity: FAST_EFFECTS }, "::before");
  });

  test("with reduced motion, the default timing doesn't bring transitions back", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/tests/button");
    const button = page
      .getByTestId("button-no-props")
      .getByRole("button")
      .first();
    await expect(button).toHaveCSS("transition-duration", "0s");
    expect(
      await button.evaluate(
        (el) => getComputedStyle(el, "::before").transitionDuration
      )
    ).toBe("0s");
  });

  test("ButtonIcon: colors on fast effects, corners on fast spatial", async ({
    page,
  }) => {
    await page.goto("/tests/button-icon");
    const button = page
      .getByTestId("button-icon-no-props")
      .getByRole("button")
      .first();
    await expectTransitions(button, {
      color: FAST_EFFECTS,
      "background-color": FAST_EFFECTS,
      "border-radius": FAST_SPATIAL,
    });
  });

  test("Fab: its shadow on fast effects", async ({ page }) => {
    await page.goto("/tests/fab");
    const fab = page.getByTestId("fab-no-props").getByRole("button").first();
    await expectTransitions(fab, {
      "box-shadow": FAST_EFFECTS,
      padding: FAST_SPATIAL,
    });
  });

  test("Details: the chevron turns on fast spatial", async ({ page }) => {
    await page.goto("/tests/details");
    const chevron = page
      .getByTestId("details-default")
      .locator("summary svg[data-ac-details-chevron]");
    await expectTransitions(chevron, { rotate: FAST_SPATIAL });
  });

  test("SplitButton: corners on fast spatial, colors on fast effects, the menu icon turning on standard fast spatial", async ({
    page,
  }) => {
    await page.goto("/tests/split-button");
    const trailing = page
      .getByTestId("split-button-menu")
      .getByRole("button", { name: "More watch options" });
    await expectTransitions(trailing, {
      color: FAST_EFFECTS,
      "background-color": FAST_EFFECTS,
      "border-radius": FAST_SPATIAL,
    });
    await expectTransitions(
      trailing.locator("[data-ac-split-button-part=icon]"),
      { rotate: STANDARD_FAST_SPATIAL, translate: STANDARD_FAST_SPATIAL }
    );
  });

  test("Tabs: the indicator moves on fast spatial, tab colors on fast effects", async ({
    page,
  }) => {
    await page.goto("/tests/tabs");
    const tabs = page.getByTestId("tabs-default");
    await expectTransitions(tabs.locator("[data-ac-tab-indicator]"), {
      left: FAST_SPATIAL,
      right: FAST_SPATIAL,
    });
    await expectTransitions(tabs.getByRole("tab").first(), {
      color: FAST_EFFECTS,
    });
  });

  test("Tabs: a panel enters on emphasized decelerate and leaves on emphasized accelerate", async ({
    page,
  }) => {
    await page.goto("/tests/tabs");
    const tabs = page.getByTestId("tabs-transition-fade-up");
    const panels = tabs.getByRole("tabpanel", { includeHidden: true });
    await expectTransitions(panels.first(), {
      opacity: ENTER,
      translate: ENTER,
    });
    await expectTransitions(panels.nth(1), { opacity: EXIT, translate: EXIT });
  });

  test("Dialog: enters on emphasized decelerate, leaves on emphasized accelerate, with its scrim", async ({
    page,
  }) => {
    await page.goto("/tests/dialog");
    const dialogCase = page.getByTestId("dialog-basic");
    const dialog = dialogCase.locator("#basic-dialog");
    await expectTransitions(dialog, { opacity: EXIT, translate: EXIT });

    await dialogCase.getByRole("button", { name: "Open Dialog" }).click();
    await expect(dialog).toBeVisible();
    await expectTransitions(dialog, { opacity: ENTER, translate: ENTER });
    await expectTransitions(dialog, { opacity: ENTER }, "::backdrop");
  });

  test("Tooltip: fades on fast effects", async ({ page }) => {
    await page.goto("/tests/tooltip");
    const tooltip = page
      .getByTestId("tooltip-plain")
      .getByRole("link", { name: "GitHub repository" })
      .locator("[data-ac-tooltip]");
    await expectTransitions(tooltip, { opacity: FAST_EFFECTS });
  });

  test("SheetBottom: a modal sheet enters on emphasized decelerate and leaves on emphasized accelerate", async ({
    page,
  }) => {
    await page.goto("/tests/sheet-bottom");
    const sheetCase = page.getByTestId("sheet-bottom-modal");
    const sheet = sheetCase.locator('[data-ac-sheet-bottom="modal"]');
    await expectTransitions(sheet, { translate: EXIT });

    await sheetCase
      .getByRole("button", { name: "Open bottom sheet", exact: true })
      .click();
    await expectTransitions(sheet, { translate: ENTER });
  });

  test("SheetSide: a modal sheet enters on emphasized decelerate and leaves on emphasized accelerate", async ({
    page,
  }) => {
    await page.goto("/tests/sheet-side");
    const sheetCase = page.getByTestId("sheet-side-modal");
    const sheet = sheetCase.locator('[data-ac-sheet-side="modal"]');
    await expectTransitions(sheet, { translate: EXIT });

    await sheetCase
      .getByRole("button", { name: "Open side sheet", exact: true })
      .click();
    await expectTransitions(sheet, { translate: ENTER });
  });

  test.describe("compact", () => {
    test.use({ viewport: { width: 400, height: 800 } });

    test("NavRail: the modal rail and its scrim slide and fade on standard, emphasized's web fallback", async ({
      page,
    }) => {
      await page.goto("/components/button");
      await expectTransitions(page.locator("[data-ac-nav-rail]"), {
        "inset-inline-start": STANDARD,
      });
      await expectTransitions(page.locator("[data-ac-nav-rail-scrim]"), {
        opacity: STANDARD,
      });
    });
  });

  test.describe("medium", () => {
    test.use({ viewport: { width: 700, height: 800 } });

    test("NavRail: an expandable rail expands on default spatial", async ({
      page,
    }) => {
      await page.goto("/tests/nav-rail-expandable");
      await expectTransitions(page.locator("[data-ac-nav-rail]"), {
        width: DEFAULT_SPATIAL,
      });
    });

    test("NavDrawer: the modal drawer and its scrim slide and fade on standard", async ({
      page,
    }) => {
      await page.goto("/components/button");
      await expectTransitions(page.locator("[data-ac-nav-drawer]"), {
        translate: STANDARD,
      });
      await expectTransitions(page.locator("[data-ac-nav-drawer-scrim]"), {
        opacity: STANDARD,
      });
    });
  });

  test("NavRailSubItems: its content fades on default effects", async ({
    page,
  }) => {
    await page.goto("/tests/nav-rail-expandable");
    await expectTransitions(page.locator("[data-ac-nav-section]").first(), {
      opacity: DEFAULT_EFFECTS,
    });
  });
});
