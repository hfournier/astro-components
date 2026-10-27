import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor, settled } from "./support/helpers";

// Each case on /tests/progress-circular is a Section with
// data-testid="progress-circular-<caseId>". Each indicator is named by its aria-label.
type ProgressCircularCaseId =
  "determinate" | "indeterminate" | "thick" | "wavy" | "size" | "rtl";

const section = (page: Page, caseId: ProgressCircularCaseId) =>
  page.getByTestId(`progress-circular-${caseId}`);

const indicator = (page: Page, caseId: ProgressCircularCaseId, name: string) =>
  section(page, caseId).getByRole("progressbar", { name, exact: true });

// The element around the <progress>, which draws M3's parts
const root = (progress: Locator) =>
  progress.locator("xpath=ancestor::*[@data-ac-progress-circular][1]");

// M3's anatomy: the active indicator and the track. A wavy active indicator is a path.
const part = (progress: Locator, name: "active-indicator" | "track") =>
  root(progress).locator(`[data-ac-progress-circular-part="${name}"]`);

const wave = (progress: Locator) =>
  root(progress).locator(
    'path[data-ac-progress-circular-part="active-indicator"]'
  );

const style = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );

const colorRole = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

const setValue = (progress: Locator, value: number | null) =>
  progress.evaluate((el: HTMLProgressElement, v) => {
    if (v === null) el.removeAttribute("value");
    else el.value = v;
  }, value);

type Drawn = "active" | "track" | "none";

// What the indicator draws at each angle (degrees clockwise from 12 o'clock) on a circle of the
// given radius around its center: the active indicator (primary), the track
// (secondary-container) or nothing (the page behind it), read from a screenshot's pixels
const ring = async (
  progress: Locator,
  radius: number,
  angles: number[]
): Promise<Drawn[]> => {
  const target = root(progress);
  const png = (await target.screenshot()).toString("base64");
  return target.evaluate(
    async (el, { png, radius, angles }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const rgb = (x: number, y: number) =>
        Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3));
      const role = (name: string) => {
        const probe = document.createElement("div");
        probe.style.color = `var(--theme-color-${name})`;
        el.appendChild(probe);
        const color = getComputedStyle(probe).color.match(/[\d.]+/g)!;
        probe.remove();
        return color.slice(0, 3).map(Number);
      };
      // a corner of the box is outside the ring, so it shows the page behind
      const references: [string, number[]][] = [
        ["active", role("primary")],
        ["track", role("secondary-container")],
        ["none", rgb(0, 0)],
      ];
      // the screenshot is at the device's pixel ratio (2 in WebKit's Desktop Safari)
      const scale = devicePixelRatio;
      const center = image.width / 2;
      return angles.map((angle) => {
        const radians = (angle * Math.PI) / 180;
        const color = rgb(
          Math.floor(center + radius * scale * Math.sin(radians)),
          Math.floor(center - radius * scale * Math.cos(radians))
        );
        const distance = (reference: number[]) =>
          reference.reduce((sum, c, i) => sum + (c - color[i]) ** 2, 0);
        return references.reduce((nearest, candidate) =>
          distance(candidate[1]) < distance(nearest[1]) ? candidate : nearest
        )[0];
      });
    },
    { png, radius, angles }
  ) as Promise<Drawn[]>;
};

// The angle, clockwise from 12 o'clock, that an arc length along a circle of the given radius
// spans
const degrees = (length: number, radius: number) =>
  (length / (2 * Math.PI * radius)) * 360;

// The wave's radial extent, without its stroke: 0 when flat, twice the amplitude when wavy
const waveDepth = (progress: Locator) =>
  wave(progress)
    .first()
    .evaluate((path: SVGPathElement) => {
      if (!path.getAttribute("d")) return 0;
      const svg = path.ownerSVGElement!;
      const { width } = svg.viewBox.baseVal;
      const length = path.getTotalLength();
      const radii = Array.from({ length: 200 }, (_, i) => {
        const point = path.getPointAtLength((length * i) / 199);
        return Math.hypot(point.x - width / 2, point.y - width / 2);
      });
      return Math.max(...radii) - Math.min(...radii);
    });

test.describe("ProgressCircular", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/progress-circular");
  });

  test("is a native progress element, exposed as a progressbar with its value and name", async ({
    page,
  }) => {
    await expect(
      indicator(page, "determinate", "Uploading photos")
    ).toHaveJSProperty("position", 0.25);
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

  // 40px, a 4px ring of radius 18: at 25% the active indicator runs from 12 to 3 o'clock, then
  // M3's 4px gap, between the round caps, and the track around to a gap before the start
  test("determinate: M3's 40px indicator fills clockwise from the top, a 4px gap either side of the track", async ({
    page,
  }) => {
    const progress = indicator(page, "determinate", "Uploading photos");
    const { width, height } = await box(root(progress));
    expect([width, height]).toEqual([40, 40]);
    const radius = 18;
    const activeEnd = 90 + degrees(2, radius);
    const trackStart = 90 + degrees(8 - 2, radius);
    const activeStart = 360 - degrees(2, radius);
    const trackEnd = 360 - degrees(8 - 2, radius);
    expect(
      await ring(progress, radius, [
        5,
        45,
        85,
        (activeEnd + trackStart) / 2,
        trackStart + 3,
        180,
        trackEnd - 3,
        (trackEnd + activeStart) / 2,
        358,
      ])
    ).toEqual([
      "active",
      "active",
      "active",
      "none",
      "track",
      "track",
      "track",
      "none",
      "active",
    ]);
    // the ring is 4px thick
    for (const offset of [-1, 1]) {
      expect(await ring(progress, radius + offset, [45, 135])).toEqual([
        "active",
        "track",
      ]);
    }
    for (const offset of [-3.5, 3.5]) {
      expect(await ring(progress, radius + offset, [45, 135])).toEqual([
        "none",
        "none",
      ]);
    }
  });

  test("at 0% only the track shows, all the way round; just started, the active indicator is a dot; at 100% the track is gone", async ({
    page,
  }) => {
    const angles = [0, 90, 180, 270];
    expect(
      await ring(indicator(page, "determinate", "Not started"), 18, angles)
    ).toEqual(["track", "track", "track", "track"]);

    // a dot, as long as the ring is thick, its round caps over the track: the gap is no longer
    // than the active indicator, so it has barely opened
    const started = indicator(page, "determinate", "Just started");
    const dotEnd = degrees(0.01 * 2 * Math.PI * 18 + 2, 18);
    expect(await ring(started, 18, [1, dotEnd + 3, 180])).toEqual([
      "active",
      "track",
      "track",
    ]);

    expect(
      await ring(indicator(page, "determinate", "Done"), 18, angles)
    ).toEqual(["active", "active", "active", "active"]);
  });

  test("colors: a primary active indicator on a secondary-container track, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const progress = indicator(page, "determinate", "Uploading photos");
      const primary = await colorRole(page, "primary");
      await expect(part(progress, "active-indicator")).toHaveCSS(
        "stroke",
        primary
      );
      await expect(part(progress, "track")).toHaveCSS(
        "stroke",
        await colorRole(page, "secondary-container")
      );
      await expect(wave(indicator(page, "wavy", "Wavy, halfway"))).toHaveCSS(
        "stroke",
        primary
      );
      expect(await ring(progress, 18, [45, 180])).toEqual(["active", "track"]);
    }
  });

  test("the thick track: 44px, 8px thick, with a 4px gap", async ({ page }) => {
    const progress = indicator(page, "thick", "Thick, determinate");
    const { width } = await box(root(progress));
    expect(width).toBe(44);
    const radius = 18;
    for (const offset of [-2.5, 2.5]) {
      expect(await ring(progress, radius + offset, [45, 135])).toEqual([
        "active",
        "track",
      ]);
    }
    for (const offset of [-6.5, 6]) {
      expect(await ring(progress, radius + offset, [45, 135])).toEqual([
        "none",
        "none",
      ]);
    }
    const activeEnd = 90 + degrees(4, radius);
    const trackStart = 90 + degrees(12 - 4, radius);
    expect(
      await ring(progress, radius, [(activeEnd + trackStart) / 2])
    ).toEqual(["none"]);
  });

  test("size sets the container, and the ring stays 4px thick inside its edge", async ({
    page,
  }) => {
    const large = indicator(page, "size", "Large");
    expect((await box(root(large))).width).toBe(96);
    expect(await ring(large, 46, [45, 180])).toEqual(["active", "track"]);
    expect(await ring(large, 42.5, [45, 180])).toEqual(["none", "none"]);
    expect(
      (await box(root(indicator(page, "size", "Small, indeterminate")))).width
    ).toBe(24);
  });

  test("size is kept within M3's 24px to 240px", async ({ page }) => {
    const small = indicator(page, "size", "Below M3's smallest");
    expect((await box(root(small))).width).toBe(24);
    expect(await ring(small, 10, [45, 180])).toEqual(["active", "track"]);
    const large = indicator(page, "size", "Above M3's largest");
    expect((await box(root(large))).width).toBe(240);
    expect(await ring(large, 118, [45, 180])).toEqual(["active", "track"]);
  });

  // 24px, so a 12px track is kept to 6px: a ring of radius 9 from 6px to 12px out, leaving a hole
  test("thickness is kept within a quarter of the size, so the ring leaves a hole", async ({
    page,
  }) => {
    const progress = indicator(
      page,
      "size",
      "Thicker than a quarter of its size"
    );
    expect((await box(root(progress))).width).toBe(24);
    expect(await ring(progress, 9, [45, 225])).toEqual(["active", "track"]);
    expect(await ring(progress, 4, [45, 225])).toEqual(["none", "none"]);
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
    expect(await duration("--ac-progress-circular-progress")).toBe(
      await token("fast-effects")
    );
    expect(await duration("--ac-progress-circular-amplitude")).toBe(
      await token("fast-spatial")
    );
    await setValue(progress, 0.75);
    await settled(page);
    expect(await ring(progress, 18, [180, 265, 300])).toEqual([
      "active",
      "active",
      "track",
    ]);
  });

  test("indeterminate: Compose's 6s cycle turns the indicator, its active indicator growing and shrinking", async ({
    page,
  }) => {
    const progress = indicator(page, "indeterminate", "Loading news article");
    const timings = await root(progress).evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .map((animation) => animation.effect!.getComputedTiming())
        .map(({ duration, iterations }) => ({ duration, iterations }))
    );
    expect(timings.length).toBeGreaterThanOrEqual(3);
    for (const timing of timings) {
      expect(timing).toEqual({ duration: 6000, iterations: Infinity });
    }
    const angles = Array.from({ length: 12 }, (_, i) => i * 30 + 15);
    const start = (await ring(progress, 18, angles)).join();
    await expect
      .poll(async () => (await ring(progress, 18, angles)).join())
      .not.toBe(start);
  });

  test("an indeterminate indicator turns determinate when it gets a value", async ({
    page,
  }) => {
    const progress = indicator(page, "indeterminate", "Loading news article");
    await setValue(progress, 0.5);
    await expect(progress).toHaveJSProperty("position", 0.5);
    await settled(page);
    expect(
      await root(progress).evaluate(
        (el) => el.getAnimations({ subtree: true }).length
      )
    ).toBe(0);
    expect(await ring(progress, 18, [10, 90, 170, 270])).toEqual([
      "active",
      "active",
      "active",
      "track",
    ]);
  });

  // M3's wavy indicator is 48px: a 4px ring waving 1.6px either side of radius 20.4
  test("wavy: a 48px container (52px thick) whose active indicator waves 1.6px either side of the track", async ({
    page,
  }) => {
    const halfway = indicator(page, "wavy", "Wavy, halfway");
    expect((await box(root(halfway))).width).toBe(48);
    expect(
      (await box(root(indicator(page, "wavy", "Wavy, thick")))).width
    ).toBe(52);
    await expect.poll(() => waveDepth(halfway)).toBeCloseTo(3.2, 0);
    expect(await ring(halfway, 20.4, [270])).toEqual(["track"]);
    expect(await ring(halfway, 20.4 + 3, [225])).toEqual(["none"]);
    // M3's wave starts after 10% and flattens again from 95%
    await expect
      .poll(() => waveDepth(indicator(page, "wavy", "Wavy, starting")))
      .toBeLessThan(0.1);
    await expect
      .poll(() => waveDepth(indicator(page, "wavy", "Wavy, nearly done")))
      .toBeLessThan(0.1);
  });

  // M3's 15px wavelength, rounded to a whole number of waves around the circle
  test("wavy: about 15px from one crest to the next, travelling, and the indeterminate indicator waves too", async ({
    page,
  }) => {
    const halfway = indicator(page, "wavy", "Wavy, halfway");
    await expect.poll(() => waveDepth(halfway)).toBeCloseTo(3.2, 0);
    const crests = await wave(halfway).evaluate((path: SVGPathElement) => {
      const length = path.getTotalLength();
      const radii = Array.from({ length: 400 }, (_, i) => {
        const point = path.getPointAtLength((length * i) / 399);
        return Math.hypot(point.x - 24, point.y - 24);
      });
      // each time the wave rises past halfway to its crest (the path's points are rounded, so
      // it wobbles where it's nearly flat)
      const crest = 20.4 + 0.8;
      return radii.filter((r, i) => i > 0 && r >= crest && radii[i - 1] < crest)
        .length;
    });
    // half the circle, at 9 waves around it
    expect(crests).toBeGreaterThanOrEqual(4);
    expect(crests).toBeLessThanOrEqual(5);
    const before = await wave(halfway).getAttribute("d");
    await expect.poll(() => wave(halfway).getAttribute("d")).not.toBe(before);

    const indeterminate = indicator(page, "wavy", "Wavy, indeterminate");
    await expect.poll(() => waveDepth(indeterminate)).toBeCloseTo(3.2, 0);
    const thick = indicator(page, "wavy", "Wavy, thick, indeterminate");
    expect((await box(root(thick))).width).toBe(52);
    await expect.poll(() => waveDepth(thick)).toBeCloseTo(3.2, 0);
  });

  // M3: circular indicators don't need to be mirrored
  test("right to left, it still fills clockwise from the top", async ({
    page,
  }) => {
    const progress = indicator(page, "rtl", "Right to left");
    expect(await ring(progress, 18, [45, 315])).toEqual(["active", "track"]);
    const wavy = indicator(page, "rtl", "Right to left, wavy");
    await expect.poll(() => waveDepth(wavy)).toBeCloseTo(3.2, 0);
    // the wave runs down the right half, from 12 o'clock to 6
    const outer = await box(root(wavy));
    const path = await box(wave(wavy));
    expect(path.x).toBeGreaterThan(outer.x + outer.width / 2 - 3);
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
      await expect.poll(() => waveDepth(halfway)).toBeCloseTo(3.2, 0);
      const before = await wave(halfway).getAttribute("d");
      await page.waitForTimeout(200);
      expect(await wave(halfway).getAttribute("d")).toBe(before);
    });

    // ADR-0003: no animation, so the indeterminate indicator holds still, its active indicator
    // from 20% to 60% of the way round, which still reads as work going on
    test("an indeterminate indicator holds still, from 20% to 60% of the way round", async ({
      page,
    }) => {
      const progress = indicator(page, "indeterminate", "Loading news article");
      expect(
        await root(progress).evaluate(
          (el) => el.getAnimations({ subtree: true }).length
        )
      ).toBe(0);
      expect(await ring(progress, 18, [30, 80, 140, 210, 260, 330])).toEqual([
        "track",
        "active",
        "active",
        "active",
        "track",
        "track",
      ]);

      const wavy = indicator(page, "wavy", "Wavy, indeterminate");
      await expect.poll(() => waveDepth(wavy)).toBeCloseTo(3.2, 0);
    });
  });
});
