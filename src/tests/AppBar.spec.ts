import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  castsNoShadow,
  colorInside,
  expectFocusRing,
  resolvedColor,
  settled,
  textBox,
} from "./support/helpers";

// Each case on /tests/app-bar is a Section with data-testid="app-bar-<caseId>"
type AppBarCaseId =
  | "anatomy"
  | "headline-only"
  | "centered"
  | "long"
  | "filled-action"
  | "scroll"
  | "rtl";

const section = (page: Page, caseId: AppBarCaseId) =>
  page.getByTestId(`app-bar-${caseId}`);

// An app bar is the element marked data-ac-app-bar; its headline and subtitle are its parts
const bars = (page: Page, caseId: AppBarCaseId) =>
  section(page, caseId).locator("[data-ac-app-bar]");
const bar = (page: Page, caseId: AppBarCaseId) => bars(page, caseId).first();
const part = (target: Locator, name: "headline" | "subtitle") =>
  target.locator(`[data-ac-app-bar-part="${name}"]`);

// The page's own app bar, on /tests/app-bar-page
const bannerBar = (page: Page) =>
  page.getByRole("banner").locator("[data-ac-app-bar]");

const role = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

const center = ({ x, width }: { x: number; width: number }) => x + width / 2;

test.describe("AppBar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/app-bar");
  });

  // M3's Specs: 64dp high, spanning its container. Its measurements: 4dp, then the leading
  // button's 48dp target, then 4dp before the headline; at the end, each action's 48dp target and
  // 4dp after the last. Icons 24dp.
  test("takes M3's height and measurements: 4px, 48px targets, the headline 4px after", async ({
    page,
  }) => {
    const appBar = bar(page, "anatomy");
    const outer = await box(appBar);
    const parent = await box(appBar.locator(".."));
    expect(outer.height).toBe(64);
    expect(outer.width).toBeCloseTo(parent.width - 32, 0);

    const back = appBar.getByRole("button", { name: "Back" });
    const search = appBar.getByRole("button", { name: "Search" });
    const calendar = appBar.getByRole("button", { name: "Calendar" });

    // each target is 48px wide, so each button's center is half of that from the target's edge
    expect(center(await box(back)) - outer.x).toBeCloseTo(4 + 24, 0);
    expect(outer.x + outer.width - center(await box(calendar))).toBeCloseTo(
      4 + 24,
      0
    );
    expect(center(await box(calendar)) - center(await box(search))).toBeCloseTo(
      48,
      0
    );
    for (const button of [back, search, calendar]) {
      expect((await box(button.locator("svg"))).width).toBeCloseTo(24, 1);
      // vertically centered in the 64px bar
      expect(
        (await box(button)).y + (await box(button)).height / 2 - outer.y
      ).toBeCloseTo(32, 0);
    }

    // the headline starts 4 + 48 + 4 = 56px in
    expect((await textBox(part(appBar, "headline"))).x - outer.x).toBeCloseTo(
      56,
      0
    );
    expect((await textBox(part(appBar, "subtitle"))).x - outer.x).toBeCloseTo(
      56,
      0
    );
  });

  // Compose's TopAppBar: without a navigation icon, the title starts 16dp in
  test("without a leading button, the headline starts 16px in", async ({
    page,
  }) => {
    const appBar = bar(page, "headline-only");
    expect(
      (await textBox(part(appBar, "headline"))).x - (await box(appBar)).x
    ).toBeCloseTo(16, 0);
    await expect(appBar).toHaveCSS("height", "64px");
  });

  // M3's Guidelines: Small headline in Title Large, subtitle in Label Medium
  test("sets the headline in Title Large and the subtitle in Label Medium, on one line each", async ({
    page,
  }) => {
    const appBar = bar(page, "anatomy");
    const headline = part(appBar, "headline");
    await expect(headline).toHaveCSS("font-size", "22px");
    await expect(headline).toHaveCSS("line-height", "28px");
    await expect(headline).toHaveCSS("font-weight", "400");
    await expect(headline).toHaveCSS("white-space", "nowrap");

    const subtitle = part(appBar, "subtitle");
    await expect(subtitle).toHaveCSS("font-size", "12px");
    await expect(subtitle).toHaveCSS("line-height", "16px");
    await expect(subtitle).toHaveCSS("font-weight", "500");
    await expect(subtitle).toHaveCSS("letter-spacing", "0.5px");
    await expect(subtitle).toHaveCSS("white-space", "nowrap");

    // the two lines, centered together in the bar
    const outer = await box(appBar);
    const top = (await box(headline)).y;
    const bottom = (await box(subtitle)).y + (await box(subtitle)).height;
    expect((top + bottom) / 2 - outer.y).toBeCloseTo(32, 0);
  });

  // M3's Specs, color: surface; leading icon and headline on-surface; trailing icons and
  // subtitle on-surface-variant. Flat, with no shadow.
  test("takes M3's color roles, in light and dark", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const appBar = bar(page, "anatomy");

      await expect(appBar).toHaveCSS(
        "background-color",
        await role(page, "surface")
      );
      expect(await castsNoShadow(appBar)).toBe(true);
      await expect(appBar).toHaveCSS("border-top-left-radius", "0px");
      await expect(appBar.getByRole("button", { name: "Back" })).toHaveCSS(
        "color",
        await role(page, "on-surface")
      );
      await expect(part(appBar, "headline")).toHaveCSS(
        "color",
        await role(page, "on-surface")
      );
      await expect(part(appBar, "subtitle")).toHaveCSS(
        "color",
        await role(page, "on-surface-variant")
      );
      for (const name of ["Search", "Calendar"])
        await expect(appBar.getByRole("button", { name })).toHaveCSS(
          "color",
          await role(page, "on-surface-variant")
        );
    }
  });

  // M3's filled trailing icon button configuration: a filled icon button keeps its own colors
  test("a filled action keeps its own container and colors", async ({
    page,
  }) => {
    const send = bar(page, "filled-action").getByRole("button", {
      name: "Send",
    });
    await expect(send).toHaveCSS(
      "background-color",
      await role(page, "primary")
    );
    await expect(send).toHaveCSS("color", await role(page, "on-primary"));
    // a wide button's 52px, 4px from the end
    const appBar = await box(bar(page, "filled-action"));
    const target = await box(send);
    expect(target.width).toBe(52);
    expect(appBar.x + appBar.width - (target.x + target.width)).toBeCloseTo(
      4,
      0
    );
  });

  // M3's Specs, configurations: centered text, headline and subtitle centered in the bar
  test("centers the headline and subtitle in the bar, whatever is either side", async ({
    page,
  }) => {
    const appBar = bar(page, "centered");
    const outer = await box(appBar);
    for (const name of ["headline", "subtitle"] as const) {
      const text = await textBox(part(appBar, name));
      expect(center(text)).toBeCloseTo(center(outer), 0);
    }
    // the leading button stays at the start, the actions at the end
    expect(
      center(await box(appBar.getByRole("button", { name: "Menu" }))) - outer.x
    ).toBeCloseTo(28, 0);
    expect(
      outer.x +
        outer.width -
        center(await box(appBar.getByRole("button", { name: "Share" })))
    ).toBeCloseTo(28, 0);
  });

  // M3's Guidelines: don't wrap text in a small app bar. A headline too long for it is cut off
  // with an ellipsis, short of the buttons, start-aligned or centered.
  test("keeps a long headline on one line, short of the buttons", async ({
    page,
  }) => {
    for (const appBar of await bars(page, "long").all()) {
      const headline = part(appBar, "headline");
      await expect(headline).toHaveCSS("text-overflow", "ellipsis");
      expect(
        await headline.evaluate((el) => el.scrollWidth > el.clientWidth)
      ).toBe(true);
      await expect(appBar).toHaveCSS("height", "64px");
      expect((await box(headline)).height).toBe(28);

      const text = await box(headline);
      const back = await box(appBar.getByRole("button", { name: "Back" }));
      const edit = await box(appBar.getByRole("button", { name: "Edit" }));
      // 4px either side of the headline, then each button's 48px target
      expect(text.x).toBeGreaterThanOrEqual(back.x + back.width + 4 + 4 - 0.5);
      expect(text.x + text.width).toBeLessThanOrEqual(edit.x - 4 - 4 + 0.5);
    }
  });

  // M3's Accessibility page: Tab moves through the buttons in order, starting at the leading
  // button, each with a focus ring
  test("Tab reaches the leading button first, then the actions, each with a focus ring", async ({
    page,
  }) => {
    const appBar = bar(page, "anatomy");
    await section(page, "anatomy").getByRole("heading").click();
    for (const name of ["Back", "Search", "Calendar"]) {
      await page.keyboard.press("Tab");
      const button = appBar.getByRole("button", { name });
      await expect(button).toBeFocused();
      await expectFocusRing(button);
    }
  });

  // The headline is text, not a heading: M3 lets it name the product, a section or the page, so
  // the page's own heading stays the page's
  test("shows the headline and subtitle as text, in reading order", async ({
    page,
  }) => {
    const appBar = bar(page, "anatomy");
    await expect(appBar.getByRole("heading")).toHaveCount(0);
    await expect(appBar).toMatchAriaSnapshot(`
      - button "Back"
      - text: Inbox 12 unread
      - button "Search"
      - button "Calendar"
    `);
  });

  // M3's Behavior: the container fills with surface container when content scrolls under it,
  // without a shadow, on fast effects, and clears once it's back at the top
  test("fills with surface container while content scrolls under it", async ({
    page,
  }) => {
    const appBar = bar(page, "scroll");
    const scroller = appBar.locator("..");
    await scroller.scrollIntoViewIfNeeded();
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface")
    );

    await scroller.evaluate((el) => el.scrollTo({ top: 80 }));
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface-container")
    );
    expect(await castsNoShadow(appBar)).toBe(true);
    // what sits on it, such as a focus ring's offset, matches it
    expect(await colorInside(appBar, "--theme-color-wrapper-bg")).toBe(
      await role(page, "surface-container")
    );
    // still pinned to the top of the scrolling box
    expect((await box(appBar)).y).toBeCloseTo((await box(scroller)).y + 1, 0);

    await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface")
    );
  });

  // The script finds each bar as the page scrolls, so one added after the page loaded fills too
  test("a bar added after the page loaded fills too", async ({ page }) => {
    const scroller = bar(page, "scroll").locator("..");
    await scroller.evaluate((el) => {
      const added = el.querySelector("[data-ac-app-bar]")!.cloneNode(true);
      (added as Element).setAttribute("data-testid", "added-bar");
      el.prepend(added);
    });
    const added = page.getByTestId("added-bar");
    await scroller.evaluate((el) => el.scrollTo({ top: 80 }));
    await expect(added).toHaveCSS(
      "background-color",
      await role(page, "surface-container")
    );
  });

  // Content passes under a bar only when it's pinned: one scrolling with the page stays surface
  test("a bar that scrolls with its page stays surface", async ({ page }) => {
    const appBar = bar(page, "anatomy");
    await page.evaluate(() => window.scrollTo({ top: 100 }));
    await settled(page);
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface")
    );
  });

  // M3's Adaptive design: the layout mirrors in right-to-left
  test("mirrors in right to left", async ({ page }) => {
    const [start, centered] = await bars(page, "rtl").all();
    const outer = await box(start!);
    const right = outer.x + outer.width;
    expect(
      right - center(await box(start!.getByRole("button", { name: "رجوع" })))
    ).toBeCloseTo(28, 0);
    expect(
      center(await box(start!.getByRole("button", { name: "التقويم" }))) -
        outer.x
    ).toBeCloseTo(28, 0);
    const headline = await textBox(part(start!, "headline"));
    expect(right - (headline.x + headline.width)).toBeCloseTo(56, 0);

    const centeredBox = await box(centered!);
    expect(center(await textBox(part(centered!, "headline")))).toBeCloseTo(
      center(centeredBox),
      0
    );
    expect(
      centeredBox.x +
        centeredBox.width -
        center(await box(centered!.getByRole("button", { name: "القائمة" })))
    ).toBeCloseTo(28, 0);
  });

  test("respects reduced motion: the color changes at once", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const appBar = bar(page, "scroll");
    await expect(appBar).toHaveCSS("transition-duration", "0s");
  });
});

// An app bar sits in the page's header landmark, pinned there while the page scrolls under it
test.describe("AppBar in the page header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/app-bar-page");
  });

  test("sits in the page's banner landmark", async ({ page }) => {
    const appBar = bannerBar(page);
    await expect(appBar).toBeVisible();
    await expect(part(appBar, "headline")).toHaveText("Photos");
  });

  test("fills with surface container while the page scrolls under it", async ({
    page,
  }) => {
    const appBar = bannerBar(page);
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface")
    );
    await page.evaluate(() => window.scrollTo({ top: 300 }));
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface-container")
    );
    expect((await box(appBar)).y).toBe(0);

    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface")
    );
  });

  // A page loaded part way down, such as at a link to a fragment, starts filled
  test("starts filled when the page loads scrolled", async ({ page }) => {
    await page.goto("/tests/app-bar-page#photo-30");
    const appBar = bannerBar(page);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface-container")
    );
  });
});
