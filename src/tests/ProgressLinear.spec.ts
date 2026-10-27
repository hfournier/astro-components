import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor, settled } from "./support/helpers";

// Each case on /tests/progress-linear is a Section with
// data-testid="progress-linear-<caseId>". Each indicator is named by its aria-label.
type ProgressLinearCaseId =
  "determinate" | "indeterminate" | "thick" | "wavy" | "rtl";

const section = (page: Page, caseId: ProgressLinearCaseId) =>
  page.getByTestId(`progress-linear-${caseId}`);

const indicator = (page: Page, caseId: ProgressLinearCaseId, name: string) =>
  section(page, caseId).getByRole("progressbar", { name, exact: true });

// The element around the <progress>, which draws M3's parts
const root = (progress: Locator) =>
  progress.locator("xpath=ancestor::*[@data-ac-progress-linear][1]");

// M3's anatomy: the active indicator and the track (two and three segments, for the
// indeterminate animation's two lines), and the stop indicator. A wavy active indicator is a path.
const part = (
  progress: Locator,
  name: "active-indicator" | "track" | "stop-indicator"
) => root(progress).locator(`[data-ac-progress-linear-part="${name}"]`);

const wave = (progress: Locator) =>
  root(progress).locator(
    'path[data-ac-progress-linear-part="active-indicator"]'
  );

const style = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );

const colorRole = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

// A segment's box, measured from the root's start edge (its left in LTR, its right in RTL)
const span = async (target: Locator, progress: Locator, isRtl = false) => {
  const outer = await box(root(progress));
  const inner = await target.boundingBox();
  if (!inner || inner.width === 0) return null;
  const start = isRtl
    ? outer.x + outer.width - (inner.x + inner.width)
    : inner.x - outer.x;
  return {
    start,
    end: start + inner.width,
    width: inner.width,
    height: inner.height,
    centerY: inner.y + inner.height / 2 - (outer.y + outer.height / 2),
  };
};

const setValue = (progress: Locator, value: number | null) =>
  progress.evaluate((el: HTMLProgressElement, v) => {
    if (v === null) el.removeAttribute("value");
    else el.value = v;
  }, value);

// The wave's vertical extent, without its stroke: 0 when flat, twice the amplitude when wavy
const waveHeight = (progress: Locator) =>
  wave(progress)
    .first()
    .evaluate((path: SVGPathElement) =>
      path.getAttribute("d") ? path.getBBox().height : 0
    );

test.describe("ProgressLinear", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/progress-linear");
  });

  test("is a native progress element, exposed as a progressbar with its value and name", async ({
    page,
  }) => {
    const photos = indicator(page, "determinate", "Uploading photos");
    await expect(photos).toHaveJSProperty("position", 0.4);
    await expect(
      indicator(page, "determinate", "Copying files")
    ).toHaveJSProperty("position", 0.6);
    // indeterminate: no value, so assistive tech announces no amount
    const article = indicator(page, "indeterminate", "Loading news article");
    await expect(article).toHaveJSProperty("position", -1);
    await expect(article).not.toHaveAttribute("aria-valuenow");
    await expect(
      indicator(page, "indeterminate", "Loading my episodes")
    ).toBeVisible();
  });

  test("determinate: M3's 4px track, the active indicator to the value, a 4px gap and the stop indicator", async ({
    page,
  }) => {
    const progress = indicator(page, "determinate", "Uploading photos");
    expect((await box(root(progress))).height).toBe(4);
    // 240px wide at 40%: the active indicator's rounded end reaches 96px plus its 2px cap
    const active = await span(
      part(progress, "active-indicator").first(),
      progress
    );
    expect(active).toMatchObject({ start: 0, height: 4 });
    expect(active!.end).toBeCloseTo(98, 0);
    const track = await span(part(progress, "track").first(), progress);
    expect(track!.start - active!.end).toBeCloseTo(4, 0);
    expect(track!.end).toBeCloseTo(240, 0);
    expect(track!.height).toBe(4);
    // the stop indicator: a 4px circle at the track's end
    const stop = part(progress, "stop-indicator");
    const stopBox = await span(stop, progress);
    expect(stopBox).toMatchObject({ width: 4, height: 4, centerY: 0 });
    expect(stopBox!.end).toBeCloseTo(240, 0);
    expect(await style(stop, "border-radius")).not.toBe("0px");
  });

  test("at 0% only the track shows; just started, the active indicator is a dot; at 100% the track is gone", async ({
    page,
  }) => {
    const empty = indicator(page, "determinate", "Not started");
    expect(
      await span(part(empty, "active-indicator").first(), empty)
    ).toBeNull();
    const emptyTrack = await span(part(empty, "track").first(), empty);
    expect(emptyTrack).toMatchObject({ start: 0, width: 240 });

    const started = indicator(page, "determinate", "Just started");
    const dot = await span(part(started, "active-indicator").first(), started);
    expect(dot!.width).toBeGreaterThanOrEqual(4);
    expect(dot!.width).toBeLessThan(5);

    const done = indicator(page, "determinate", "Done");
    const full = await span(part(done, "active-indicator").first(), done);
    expect(full).toMatchObject({ start: 0, width: 240 });
    for (const segment of await part(done, "track").all()) {
      expect(await span(segment, done)).toBeNull();
    }
  });

  test("colors: a primary active and stop indicator on a secondary-container track, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const progress = indicator(page, "determinate", "Uploading photos");
      const primary = await colorRole(page, "primary");
      await expect(part(progress, "active-indicator").first()).toHaveCSS(
        "background-color",
        primary
      );
      await expect(part(progress, "stop-indicator")).toHaveCSS(
        "background-color",
        primary
      );
      await expect(part(progress, "track").first()).toHaveCSS(
        "background-color",
        await colorRole(page, "secondary-container")
      );
      await expect(
        wave(indicator(page, "wavy", "Wavy, halfway")).first()
      ).toHaveCSS("stroke", primary);
    }
  });

  test("showStopIndicator={false} leaves the stop indicator out", async ({
    page,
  }) => {
    const progress = indicator(page, "determinate", "Without a stop indicator");
    await expect(part(progress, "stop-indicator")).toHaveCount(0);
  });

  test("the thick track: 8px, with a 4px gap and a 4px stop indicator 2px from the end", async ({
    page,
  }) => {
    const progress = indicator(page, "thick", "Thick, determinate");
    expect((await box(root(progress))).height).toBe(8);
    const active = await span(
      part(progress, "active-indicator").first(),
      progress
    );
    expect(active!.height).toBe(8);
    expect(active!.end).toBeCloseTo(100, 0);
    const track = await span(part(progress, "track").first(), progress);
    expect(track!.start - active!.end).toBeCloseTo(4, 0);
    const stop = await span(part(progress, "stop-indicator"), progress);
    expect(stop).toMatchObject({ width: 4, height: 4, centerY: 0 });
    expect(stop!.end).toBeCloseTo(238, 0);
  });

  // Fast effects, which doesn't overshoot, so the indicator never shows more progress than
  // there is; the wave's amplitude is a shape, on fast spatial
  test("a new value moves the active indicator and the gap on fast effects; the wave's amplitude changes on fast spatial", async ({
    page,
  }) => {
    const progress = indicator(page, "determinate", "Uploading photos");
    const duration = async (property: string) => {
      const properties = (
        await style(root(progress), "transition-property")
      ).split(", ");
      const durations = (
        await style(root(progress), "transition-duration")
      ).split(", ");
      const index = properties.indexOf(property);
      expect(index, `${property} transitions`).toBeGreaterThanOrEqual(0);
      return parseFloat(durations[index % durations.length]) * 1000;
    };
    const token = async (name: string) =>
      parseFloat(
        await style(page.locator("html"), `--theme-duration-spring-${name}`)
      );
    expect(await duration("--ac-progress-linear-progress")).toBe(
      await token("fast-effects")
    );
    expect(await duration("--ac-progress-linear-amplitude")).toBe(
      await token("fast-spatial")
    );
    await setValue(progress, 0.8);
    await settled(page);
    const active = await span(
      part(progress, "active-indicator").first(),
      progress
    );
    expect(active!.end).toBeCloseTo(194, 0);
    const track = await span(part(progress, "track").first(), progress);
    expect(track!.start - active!.end).toBeCloseTo(4, 0);
  });

  test("indeterminate: two lines run along the track, without a stop indicator", async ({
    page,
  }) => {
    const progress = indicator(page, "indeterminate", "Loading news article");
    await expect(part(progress, "stop-indicator")).toBeHidden();
    // Compose's cycle: 1750ms, each line's head and tail on emphasized accelerate
    const timings = await root(progress).evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .map((animation) => animation.effect!.getComputedTiming())
        .map(({ duration, iterations }) => ({ duration, iterations }))
    );
    expect(timings.length).toBeGreaterThanOrEqual(4);
    for (const timing of timings) {
      expect(timing).toEqual({ duration: 1750, iterations: Infinity });
    }
    const first = part(progress, "active-indicator").first();
    const position = async () => {
      const at = await span(first, progress);
      return at ? `${Math.round(at.start)}-${Math.round(at.end)}` : "none";
    };
    const start = await position();
    await expect.poll(position).not.toBe(start);
  });

  test("an indeterminate indicator turns determinate when it gets a value", async ({
    page,
  }) => {
    const progress = indicator(page, "indeterminate", "Loading news article");
    await setValue(progress, 0.5);
    await expect(progress).toHaveJSProperty("position", 0.5);
    await settled(page);
    await expect(part(progress, "stop-indicator")).toBeVisible();
    const active = await span(
      part(progress, "active-indicator").first(),
      progress
    );
    expect(active).toMatchObject({ start: 0 });
    expect(active!.end).toBeCloseTo(122, 0);
  });

  test("wavy: a 10px container (14px thick) whose active indicator waves 3px either side of the track", async ({
    page,
  }) => {
    const halfway = indicator(page, "wavy", "Wavy, halfway");
    expect((await box(root(halfway))).height).toBe(10);
    expect(
      (await box(root(indicator(page, "wavy", "Wavy, thick")))).height
    ).toBe(14);
    await expect.poll(() => waveHeight(halfway)).toBeCloseTo(6, 0);
    const track = await span(part(halfway, "track").first(), halfway);
    expect(track).toMatchObject({ height: 4, centerY: 0 });
    // M3's wave starts after 10% and flattens again from 95%
    await expect
      .poll(() => waveHeight(indicator(page, "wavy", "Wavy, starting")))
      .toBe(0);
    await expect
      .poll(() => waveHeight(indicator(page, "wavy", "Wavy, nearly done")))
      .toBe(0);
  });

  test("wavy: the wave travels, and the indeterminate lines wave too", async ({
    page,
  }) => {
    const halfway = indicator(page, "wavy", "Wavy, halfway");
    const before = await wave(halfway).first().getAttribute("d");
    await expect
      .poll(() => wave(halfway).first().getAttribute("d"))
      .not.toBe(before);

    const indeterminate = indicator(page, "wavy", "Wavy, indeterminate");
    await expect.poll(() => waveHeight(indeterminate)).toBeCloseTo(6, 0);
  });

  test("mirrors right to left: it fills from the right, and the stop indicator is on the left", async ({
    page,
  }) => {
    const progress = indicator(page, "rtl", "Right to left");
    const active = await span(
      part(progress, "active-indicator").first(),
      progress,
      true
    );
    expect(active!.start).toBeCloseTo(0, 0);
    expect(active!.end).toBeCloseTo(98, 0);
    const stop = await span(part(progress, "stop-indicator"), progress, true);
    expect(stop!.end).toBeCloseTo(240, 0);

    const wavy = indicator(page, "rtl", "Right to left, wavy");
    await expect.poll(() => waveHeight(wavy)).toBeCloseTo(6, 0);
    const path = await box(wave(wavy).first());
    const outer = await box(root(wavy));
    expect(outer.x + outer.width - (path.x + path.width)).toBeLessThan(1);
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("a new value and the wave's amplitude change at once, and the wave stands still", async ({
      page,
    }) => {
      const progress = indicator(page, "determinate", "Uploading photos");
      expect(await style(root(progress), "transition-duration")).toMatch(
        /^0s(, 0s)*$/
      );
      const halfway = indicator(page, "wavy", "Wavy, halfway");
      await expect.poll(() => waveHeight(halfway)).toBeCloseTo(6, 0);
      const before = await wave(halfway).first().getAttribute("d");
      await page.waitForTimeout(200);
      expect(await wave(halfway).first().getAttribute("d")).toBe(before);
    });

    // ADR-0003: no animation, so the indeterminate indicator holds one line in a fixed place,
    // from 20% to 60% with the track a gap either side, which still reads as work going on
    test("an indeterminate indicator holds one line still, a gap from the track on either side", async ({
      page,
    }) => {
      const progress = indicator(page, "indeterminate", "Loading news article");
      expect(
        await root(progress).evaluate(
          (el) => el.getAnimations({ subtree: true }).length
        )
      ).toBe(0);
      const line = await span(
        part(progress, "active-indicator").first(),
        progress
      );
      expect(line!.start).toBeCloseTo(46, 0);
      expect(line!.end).toBeCloseTo(146, 0);
      expect(
        await span(part(progress, "active-indicator").nth(1), progress)
      ).toBeNull();
      const tracks = await Promise.all(
        (await part(progress, "track").all()).map((segment) =>
          span(segment, progress)
        )
      );
      const [after, before] = tracks;
      expect(after!.start - line!.end).toBeCloseTo(4, 0);
      expect(after!.end).toBeCloseTo(240, 0);
      expect(before!.start).toBeCloseTo(0, 0);
      expect(line!.start - before!.end).toBeCloseTo(4, 0);
      expect(tracks[2]).toBeNull();
      await expect(part(progress, "stop-indicator")).toBeHidden();

      const wavy = indicator(page, "wavy", "Wavy, indeterminate");
      await expect.poll(() => waveHeight(wavy)).toBeCloseTo(6, 0);
    });
  });
});
