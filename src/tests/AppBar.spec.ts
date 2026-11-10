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
  | "medium"
  | "large"
  | "flexible-centered"
  | "flexible-long"
  | "flexible-scroll"
  | "rtl";

const section = (page: Page, caseId: AppBarCaseId) =>
  page.getByTestId(`app-bar-${caseId}`);

// An app bar is the element marked data-ac-app-bar; its headline and subtitle are its parts
const bars = (page: Page, caseId: AppBarCaseId) =>
  section(page, caseId).locator("[data-ac-app-bar]");
const bar = (page: Page, caseId: AppBarCaseId) => bars(page, caseId).first();
type AppBarPart =
  | "headline"
  | "subtitle"
  | "top-row"
  | "collapsed-headline"
  | "collapsed-subtitle";
const part = (target: Locator, name: AppBarPart) =>
  target.locator(`[data-ac-app-bar-part="${name}"]`);

// A flexible bar's small headline and subtitle, which fade in together once it's collapsed
const collapsedText = (target: Locator) =>
  part(target, "collapsed-headline").locator("..");

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

// M3 Expressive's medium flexible and large flexible app bars: the small app bar's row of buttons
// on top, the headline and subtitle in a row of their own below, larger and wrapping
test.describe("AppBar: medium and large flexible", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/app-bar");
  });

  // M3's Specs, tokens: medium flexible 112dp high, 136dp with a subtitle; large flexible 120dp,
  // 152dp with a subtitle. Measurements: the buttons' row is the small app bar's (8dp, 48dp
  // targets, 4dp at the sides), the headline 16dp in and the text 12dp from the bottom.
  for (const [size, heights] of [
    ["medium", [112, 136]],
    ["large", [120, 152]],
  ] as const) {
    test(`${size} flexible takes M3's heights and measurements`, async ({
      page,
    }) => {
      const [plain, withSubtitle] = await bars(page, size).all();
      for (const [appBar, height] of [
        [plain!, heights[0]],
        [withSubtitle!, heights[1]],
      ] as const) {
        const outer = await box(appBar);
        expect(outer.height).toBe(height);

        const back = appBar.getByRole("button", { name: "Back" });
        const calendar = appBar.getByRole("button", { name: "Calendar" });
        expect(center(await box(back)) - outer.x).toBeCloseTo(28, 0);
        expect(outer.x + outer.width - center(await box(calendar))).toBeCloseTo(
          28,
          0
        );
        for (const button of [back, calendar]) {
          const target = await box(button);
          // centered in the top 64px: 8px above the 48px target
          expect(target.y + target.height / 2 - outer.y).toBeCloseTo(32, 0);
        }

        const headline = part(appBar, "headline");
        expect((await textBox(headline)).x - outer.x).toBeCloseTo(16, 0);
        // the text's last line ends 12px from the bottom, the headline below the buttons' row
        const last = await box(
          height === heights[0] ? headline : part(appBar, "subtitle")
        );
        expect(outer.y + outer.height - (last.y + last.height)).toBeCloseTo(
          12,
          0
        );
        expect((await box(headline)).y - outer.y).toBeGreaterThanOrEqual(64);
      }
    });
  }

  // M3's Guidelines: medium flexible in Headline Medium with a Label Large subtitle, large
  // flexible in Display Small with a Title Medium subtitle
  test("sets each size's headline and subtitle in M3's type", async ({
    page,
  }) => {
    const medium = bars(page, "medium").nth(1);
    await expect(part(medium, "headline")).toHaveCSS("font-size", "28px");
    await expect(part(medium, "headline")).toHaveCSS("line-height", "36px");
    await expect(part(medium, "headline")).toHaveCSS("font-weight", "400");
    await expect(part(medium, "subtitle")).toHaveCSS("font-size", "14px");
    await expect(part(medium, "subtitle")).toHaveCSS("line-height", "20px");
    await expect(part(medium, "subtitle")).toHaveCSS("font-weight", "500");
    await expect(part(medium, "subtitle")).toHaveCSS("letter-spacing", "0.1px");

    const large = bars(page, "large").nth(1);
    await expect(part(large, "headline")).toHaveCSS("font-size", "36px");
    await expect(part(large, "headline")).toHaveCSS("line-height", "44px");
    await expect(part(large, "headline")).toHaveCSS("font-weight", "400");
    await expect(part(large, "subtitle")).toHaveCSS("font-size", "16px");
    await expect(part(large, "subtitle")).toHaveCSS("line-height", "24px");
    await expect(part(large, "subtitle")).toHaveCSS("font-weight", "500");
    await expect(part(large, "subtitle")).toHaveCSS("letter-spacing", "0.15px");
  });

  // M3's Specs, color: the same roles as the small app bar
  test("takes M3's color roles, in light and dark", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const appBar = bars(page, "large").nth(1);
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
      await expect(appBar.getByRole("button", { name: "Search" })).toHaveCSS(
        "color",
        await role(page, "on-surface-variant")
      );
    }
  });

  // Expanded, the small app bar's headline isn't shown: only the large one is
  test("shows the headline once, below the buttons, while expanded", async ({
    page,
  }) => {
    const appBar = bars(page, "medium").nth(1);
    await expect(collapsedText(appBar)).toHaveCSS("opacity", "0");
    await expect(appBar).toMatchAriaSnapshot(`
      - button "Back"
      - button "Search"
      - button "Calendar"
      - text: Inbox 12 unread
    `);
    await expect(appBar.getByRole("heading")).toHaveCount(0);
  });

  test("centers the headline and subtitle in the bar", async ({ page }) => {
    for (const appBar of await bars(page, "flexible-centered").all()) {
      const outer = await box(appBar);
      for (const name of ["headline", "subtitle"] as const) {
        expect(center(await textBox(part(appBar, name)))).toBeCloseTo(
          center(outer),
          0
        );
      }
      expect(
        center(await box(appBar.getByRole("button", { name: "Menu" }))) -
          outer.x
      ).toBeCloseTo(28, 0);
    }
  });

  // M3's Guidelines: in medium and large flexible app bars the headline wraps rather than being
  // cut short, and the bar grows to hold it
  test("wraps a long headline, and grows to hold it", async ({ page }) => {
    for (const appBar of await bars(page, "flexible-long").all()) {
      const headline = part(appBar, "headline");
      await expect(headline).not.toHaveCSS("white-space", "nowrap");
      expect(
        await headline.evaluate((el) => el.scrollWidth <= el.clientWidth)
      ).toBe(true);
      const lineHeight = parseFloat(
        await headline.evaluate((el) => getComputedStyle(el).lineHeight)
      );
      expect((await box(headline)).height).toBeGreaterThanOrEqual(
        2 * lineHeight
      );

      const outer = await box(appBar);
      const last = await box(appBar.locator("[data-ac-app-bar-part]").last());
      expect(outer.y + outer.height - (last.y + last.height)).toBeCloseTo(
        12,
        0
      );
      expect((await box(headline)).y - outer.y).toBeCloseTo(64, 0);
    }
  });

  test("Tab reaches the leading button first, then the actions, each with a focus ring", async ({
    page,
  }) => {
    const appBar = bars(page, "medium").first();
    await section(page, "medium").getByRole("heading").click();
    for (const name of ["Back", "Search", "Calendar"]) {
      await page.keyboard.press("Tab");
      const button = appBar.getByRole("button", { name });
      await expect(button).toBeFocused();
      await expectFocusRing(button);
    }
  });

  // M3's Behavior: scrolled, a flexible app bar becomes a small one, its headline's row passing
  // under the buttons' row, and stays small until scrolled back to the top
  test("collapses into a small app bar as its box scrolls, and expands at the top", async ({
    page,
  }) => {
    const appBar = bar(page, "flexible-scroll");
    const scroller = appBar.locator("..");
    await scroller.scrollIntoViewIfNeeded();
    const top = (await box(scroller)).y + 1;
    const topRow = part(appBar, "top-row");

    expect((await box(appBar)).y).toBeCloseTo(top, 0);
    await expect(collapsedText(appBar)).toHaveCSS("opacity", "0");

    // part way: the headline's row is passing under the buttons' row, still on surface
    await scroller.evaluate((el) => el.scrollTo({ top: 40 }));
    await expect
      .poll(async () => (await box(appBar)).y)
      .toBeCloseTo(top - 40, 0);
    expect((await box(topRow)).y).toBeCloseTo(top, 0);
    await expect(appBar).toHaveCSS(
      "background-color",
      await role(page, "surface")
    );

    // collapsed: the 64px row of buttons, pinned, filled, with the small app bar's headline
    await scroller.evaluate((el) => el.scrollTo({ top: 300 }));
    await expect
      .poll(async () => (await box(appBar)).y)
      .toBeCloseTo(top - (152 - 64), 0);
    expect((await box(topRow)).y).toBeCloseTo(top, 0);
    expect((await box(topRow)).height).toBe(64);
    await expect(topRow).toHaveCSS(
      "background-color",
      await role(page, "surface-container")
    );
    await expect(collapsedText(appBar)).toHaveCSS("opacity", "1");
    const collapsed = part(appBar, "collapsed-headline");
    await expect(collapsed).toHaveCSS("font-size", "22px");
    await expect(collapsed).toHaveCSS("white-space", "nowrap");
    await expect(part(appBar, "collapsed-subtitle")).toHaveCSS(
      "font-size",
      "12px"
    );
    expect((await textBox(collapsed)).x - (await box(appBar)).x).toBeCloseTo(
      56,
      0
    );
    // its buttons are still there to use
    await expect(appBar.getByRole("button", { name: "Back" })).toBeInViewport();

    // scrolled back up a little, it stays small; at the top, it expands
    await scroller.evaluate((el) => el.scrollTo({ top: 200 }));
    await expect
      .poll(async () => (await box(appBar)).y)
      .toBeCloseTo(top - (152 - 64), 0);
    await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
    await expect.poll(async () => (await box(appBar)).y).toBeCloseTo(top, 0);
    await expect(collapsedText(appBar)).toHaveCSS("opacity", "0");
    await expect(topRow).toHaveCSS(
      "background-color",
      await role(page, "surface")
    );
  });

  test("mirrors in right to left", async ({ page }) => {
    const appBar = bars(page, "rtl").nth(2);
    const outer = await box(appBar);
    const right = outer.x + outer.width;
    expect(
      right - center(await box(appBar.getByRole("button", { name: "رجوع" })))
    ).toBeCloseTo(28, 0);
    const headline = await textBox(part(appBar, "headline"));
    expect(right - (headline.x + headline.width)).toBeCloseTo(16, 0);
  });

  test("respects reduced motion: the small headline and color change at once", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const appBar = bar(page, "flexible-scroll");
    await expect(part(appBar, "top-row")).toHaveCSS(
      "transition-duration",
      "0s"
    );
    await expect(collapsedText(appBar)).toHaveCSS("transition-duration", "0s");
  });
});

// A flexible app bar in the page's header, collapsing as the page scrolls
test.describe("AppBar: flexible, in the page header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/app-bar-flexible-page");
  });

  test("collapses into a small app bar as the page scrolls, and expands at the top", async ({
    page,
  }) => {
    const appBar = bannerBar(page);
    await expect(appBar).toHaveCSS("height", "136px");
    await expect(part(appBar, "headline")).toBeInViewport();

    await page.evaluate(() => window.scrollTo({ top: 400 }));
    await expect.poll(async () => (await box(appBar)).y).toBe(-(136 - 64));
    expect((await box(part(appBar, "top-row"))).y).toBe(0);
    await expect(part(appBar, "top-row")).toHaveCSS(
      "background-color",
      await role(page, "surface-container")
    );
    await expect(collapsedText(appBar)).toHaveCSS("opacity", "1");
    // the page's content passes under the buttons' row, not over it
    const under = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, 32);
      return !!el?.closest("[data-ac-app-bar]");
    });
    expect(under).toBe(true);

    await page.evaluate(() => window.scrollTo({ top: 0 }));
    await expect.poll(async () => (await box(appBar)).y).toBe(0);
    await expect(collapsedText(appBar)).toHaveCSS("opacity", "0");
  });

  // A page loaded part way down starts collapsed
  test("starts collapsed when the page loads scrolled", async ({ page }) => {
    await page.goto("/tests/app-bar-flexible-page#photo-30");
    const appBar = bannerBar(page);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await expect.poll(async () => (await box(appBar)).y).toBe(-(136 - 64));
    await expect(collapsedText(appBar)).toHaveCSS("opacity", "1");
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
