import type { Locator, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  loadingIndicatorKeyframes,
  loadingIndicatorSequence,
  morphShape,
} from "../shapes";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor } from "./support/helpers";

// Each case on /tests/progress-loading is a Section with data-testid="progress-loading-<caseId>".
// Each indicator is named by its aria-label.
type ProgressLoadingCaseId = "default" | "contained" | "size" | "rtl";

const section = (page: Page, caseId: ProgressLoadingCaseId) =>
  page.getByTestId(`progress-loading-${caseId}`);

const indicator = (page: Page, caseId: ProgressLoadingCaseId, name: string) =>
  section(page, caseId).getByRole("progressbar", { name, exact: true });

// The element around the <progress>, which draws M3's parts: the container, when shown, and
// the active indicator
const root = (progress: Locator) =>
  progress.locator("xpath=ancestor::*[@data-ac-progress-loading][1]");

const activeIndicator = (progress: Locator) =>
  root(progress).locator('[data-ac-progress-loading-part="active-indicator"]');

const colorRole = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

// The whole indicator, which turns once every 4666ms around the active indicator's own turns
const spin = (progress: Locator) =>
  root(progress).locator("[aria-hidden=true]");

// The active indicator's outline, frame by frame for `ms`, as the browser has it animated: how
// many curves its clip-path's shape() is drawn with (each morph in the sequence has its own
// count) and how far it's turned
const record = (progress: Locator, ms: number) =>
  activeIndicator(progress).evaluate(
    (el, ms) =>
      new Promise<{ curves: number; turn: number }[]>((resolve) => {
        const frames: { curves: number; turn: number }[] = [];
        const start = performance.now();
        const frame = (now: number) => {
          const style = getComputedStyle(el);
          frames.push({
            curves: style.clipPath.split("curve").length - 1,
            turn: parseFloat(style.rotate),
          });
          if (now - start < ms) requestAnimationFrame(frame);
          else resolve(frames);
        };
        requestAnimationFrame(frame);
      }),
    ms
  );

// How far the shape turns from each frame to the next, in degrees, clockwise positive
const turnSteps = (frames: { turn: number }[]) =>
  frames
    .slice(1)
    .map((frame, i) => ((frame.turn - frames[i].turn + 540) % 360) - 180);

// The furthest the active indicator's outline reaches from the center of its box, in % of the
// box's side: its shape() read back as `from x y` then `curve to x y with c0 / c1` for each curve,
// sampled along each curve. Turning doesn't move a point's distance from the center.
const reach = (progress: Locator) =>
  activeIndicator(progress).evaluate((el) => {
    const numbers = (
      getComputedStyle(el).clipPath.match(/-?[\d.]+(?=%)/g) ?? []
    ).map(Number);
    let [x0, y0] = numbers;
    let furthest = Math.hypot(x0 - 50, y0 - 50);
    for (let i = 2; i + 5 < numbers.length; i += 6) {
      const [ax, ay, c0x, c0y, c1x, c1y] = numbers.slice(i, i + 6);
      for (let s = 1; s <= 20; s++) {
        const t = s / 20;
        const u = 1 - t;
        const x =
          u ** 3 * x0 + 3 * u * u * t * c0x + 3 * u * t * t * c1x + t ** 3 * ax;
        const y =
          u ** 3 * y0 + 3 * u * u * t * c0y + 3 * u * t * t * c1y + t ** 3 * ay;
        furthest = Math.max(furthest, Math.hypot(x - 50, y - 50));
      }
      [x0, y0] = [ax, ay];
    }
    return furthest;
  });

test.describe("ProgressLoading", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/progress-loading");
  });

  test("is a native progress element with no value, exposed as a busy progressbar with its name", async ({
    page,
  }) => {
    const article = indicator(page, "default", "Loading news article");
    await expect(article).toHaveJSProperty("position", -1);
    await expect(article).not.toHaveAttribute("aria-valuenow");
    await expect(
      indicator(page, "default", "Refreshing my episodes")
    ).toBeVisible();
  });

  // M3's 48dp container, its active indicator 38dp, so it fits 38/48 of the box at any turn
  test("M3's 48px indicator, its active indicator within 38px", async ({
    page,
  }) => {
    const progress = indicator(page, "default", "Loading news article");
    const { width, height } = await box(root(progress));
    expect(width).toBe(48);
    expect(height).toBe(48);
    // it turns, so its own size, not its turned box
    await expect(spin(progress)).toHaveCSS("width", "48px");
    await expect(activeIndicator(progress)).toHaveCSS("width", "48px");
    for (let i = 0; i < 5; i++) {
      expect(await reach(progress)).toBeLessThanOrEqual((38 / 48) * 50 + 0.5);
      await page.waitForTimeout(130);
    }
    expect(await reach(progress)).toBeGreaterThan(30);
  });

  test("colors: a primary active indicator, or on-primary-container on a primary-container circle, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const plain = indicator(page, "default", "Loading news article");
      await expect(activeIndicator(plain)).toHaveCSS(
        "background-color",
        await colorRole(page, "primary")
      );
      await expect(root(plain)).toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)"
      );
      const contained = indicator(page, "contained", "Refreshing page");
      await expect(activeIndicator(contained)).toHaveCSS(
        "background-color",
        await colorRole(page, "on-primary-container")
      );
      await expect(root(contained)).toHaveCSS(
        "background-color",
        await colorRole(page, "primary-container")
      );
      // a circle: corners at least half its 48px side
      expect(
        await root(contained).evaluate((el) =>
          parseFloat(getComputedStyle(el).borderTopLeftRadius)
        )
      ).toBeGreaterThanOrEqual(24);
    }
  });

  // Compose's sequence: SoftBurst, Cookie9Sided, Pentagon, Pill, Sunny, Cookie4Sided, Oval and
  // back. Each morph is drawn with its own number of curves, so the counts give the order.
  test("morphs through M3's seven shapes in turn, a new morph every 650ms, each adding a quarter turn", async ({
    page,
  }) => {
    const progress = indicator(page, "default", "Loading news article");
    const sequence = [58, 28, 22, 44, 48, 24, 48];
    const frames = await record(progress, 650 * 8);
    const runs = frames
      .map((f) => f.curves)
      .filter((curves, i, all) => i === 0 || curves !== all[i - 1]);
    // the recording starts partway through a morph, so find where in the loop it starts
    const offset = sequence.findIndex(
      (_, i) =>
        sequence.slice(i).concat(sequence.slice(0, i)).slice(0, 4).join() ===
        runs.slice(1, 5).join()
    );
    expect(offset).toBeGreaterThanOrEqual(0);
    const expected = Array.from(
      { length: runs.length - 1 },
      (_, i) => sequence[(offset + i) % sequence.length]
    );
    expect(runs.slice(1)).toEqual(expected);
    expect(runs.length).toBeGreaterThanOrEqual(8);
    // within each morph the shape turns a quarter, clockwise. Its spring overshoots by about 8°
    // and comes back, the only turning back there is.
    const steps = turnSteps(frames);
    expect(Math.min(...steps)).toBeGreaterThan(-10);
    expect(Math.max(...steps)).toBeLessThan(90);
    const total = steps.reduce((sum, step) => sum + step, 0);
    expect(total).toBeGreaterThan(90 * 7);
    expect(total).toBeLessThan(90 * 9);
  });

  test("the whole indicator also turns clockwise, once every 4666ms", async ({
    page,
  }) => {
    const progress = indicator(page, "default", "Loading news article");
    const animations = await spin(progress).evaluate((el) =>
      el.getAnimations().map((animation) => ({
        ...animation.effect!.getComputedTiming(),
        keyframes: (animation.effect as KeyframeEffect)
          .getKeyframes()
          .map((k) => k.rotate),
      }))
    );
    expect(animations).toHaveLength(1);
    expect(animations[0]).toMatchObject({
      duration: 4666,
      iterations: Infinity,
      easing: "linear",
    });
    expect(animations[0].keyframes.at(-1)).toBe("360deg");
  });

  // Computed at build time rather than drawn frame by frame: CSS animations of the shape (a cycle
  // of seven 650ms morphs) and of its quarter turns (a cycle of four), with no script
  test("the active indicator morphs and turns on CSS animations, with no script", async ({
    page,
  }) => {
    const progress = indicator(page, "default", "Loading news article");
    const animations = await activeIndicator(progress).evaluate((el) =>
      el
        .getAnimations()
        .map((animation) => ({
          name: (animation as CSSAnimation).animationName,
          ...animation.effect!.getComputedTiming(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    expect(animations).toMatchObject([
      {
        name: "ac-progress-loading-morph",
        duration: 4550,
        iterations: Infinity,
      },
      {
        name: "ac-progress-loading-turn",
        duration: 2600,
        iterations: Infinity,
      },
    ]);
    // Astro hoists a component's script out of the component, so look for it in the page. In
    // dev, Vite loads stylesheets through module scripts too (ProgressLoading.css among them),
    // so only the component's own script counts.
    expect(
      await page.evaluate(() =>
        Array.from(document.scripts).some((script) =>
          script.src.includes("ProgressLoading.astro?astro&type=script")
        )
      )
    ).toBe(false);
  });

  // Each morph has two keyframes, its start and end shapes, eased by the spring: frozen near the
  // spring's peak, the shape sits past the end shape, the same share of the way as its quarter
  // turn does (so it's tweened between the two, not switched)
  test("between keyframes, the shape is tweened on the spring, overshooting the end shape", async ({
    page,
  }) => {
    const progress = indicator(page, "default", "Loading news article");
    const { morphs, scale } = loadingIndicatorSequence();
    const numbers = (shape: string) =>
      (shape.match(/-?[\d.]+(?=%)/g) ?? []).map(Number);
    const start = numbers(morphShape(morphs[0], 0, scale));
    const end = numbers(morphShape(morphs[0], 1, scale));
    const frozen = await activeIndicator(progress).evaluate((el) => {
      el.getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = 270;
      });
      const style = getComputedStyle(el);
      return { shape: style.clipPath, turn: parseFloat(style.rotate) };
    });
    // the turn's share of its quarter, from 90deg
    const progressMade = (frozen.turn - 90) / 90;
    expect(progressMade).toBeGreaterThan(1.05);
    const tweened = numbers(frozen.shape);
    expect(tweened).toHaveLength(start.length);
    tweened.forEach((value, i) =>
      expect(value).toBeCloseTo(
        start[i] + (end[i] - start[i]) * progressMade,
        1
      )
    );
  });

  test("size scales the container and the active indicator together", async ({
    page,
  }) => {
    const large = indicator(page, "size", "Large");
    expect((await box(root(large))).width).toBe(96);
    const small = indicator(page, "size", "Small, contained");
    expect((await box(root(small))).width).toBe(24);
    // the shape keeps its share of the box, which scales with the container
    expect(await reach(large)).toBeLessThanOrEqual((38 / 48) * 50 + 0.5);
    await expect(activeIndicator(large)).toHaveCSS("width", "96px");
  });

  test("right to left, it still turns clockwise", async ({ page }) => {
    const rtl = indicator(page, "rtl", "Right to left");
    const frames = await record(rtl, 700);
    const steps = turnSteps(frames);
    expect(Math.min(...steps)).toBeGreaterThan(-10);
    expect(steps.reduce((sum, step) => sum + step, 0)).toBeGreaterThan(45);
    const keyframes = await spin(rtl).evaluate((el) =>
      (el.getAnimations()[0].effect as KeyframeEffect)
        .getKeyframes()
        .map((k) => k.rotate)
    );
    expect(keyframes.at(-1)).toBe("360deg");
  });

  // A loading indicator is often shown only while something loads, added by a script
  test("an indicator added after the others are gone still morphs", async ({
    page,
  }) => {
    const source = root(indicator(page, "default", "Loading news article"));
    const html = await source.evaluate((el) => el.outerHTML);
    await page.evaluate(() =>
      document
        .querySelectorAll("[data-ac-progress-loading]")
        .forEach((el) => el.remove())
    );
    await page.waitForTimeout(100);
    await page.evaluate((html) => {
      const holder = document.createElement("div");
      holder.dataset.testid = "progress-loading-added";
      holder.innerHTML = html.replace(
        'aria-label="Loading news article"',
        'aria-label="Added later"'
      );
      document.querySelector("main")!.append(holder);
    }, html);
    const added = page
      .getByTestId("progress-loading-added")
      .getByRole("progressbar", { name: "Added later" });
    const frames = await record(added, 800);
    expect(new Set(frames.map((f) => f.curves)).size).toBeGreaterThan(1);
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    // ADR-0003: nothing moves. It holds Compose's first frame, SoftBurst, which is still M3's
    // loading indicator.
    test("holds still on its first shape", async ({ page }) => {
      const progress = indicator(page, "default", "Loading news article");
      expect(
        await root(progress).evaluate(
          (el) => el.getAnimations({ subtree: true }).length
        )
      ).toBe(0);
      const [before] = await record(progress, 0);
      await page.waitForTimeout(700);
      const [after] = await record(progress, 0);
      expect(after).toEqual(before);
      expect(before.curves).toBe(58);
      expect(before.turn).toBe(90);
    });
  });
});

// The keyframes are generated from src/shapes.ts into ProgressLoading.css, which is committed so
// the component copies as plain files. `pnpm generate:progress-loading` rewrites it.
test("ProgressLoading.css is what src/shapes.ts generates", () => {
  const committed = readFileSync(
    fileURLToPath(
      new URL("../components/ProgressLoading.css", import.meta.url)
    ),
    "utf8"
  );
  expect(
    committed === loadingIndicatorKeyframes(),
    "ProgressLoading.css is out of date: run `pnpm generate:progress-loading`"
  ).toBe(true);
});

// A size outside M3's fails the build rather than drawing something other than was asked for.
// /tests/progress-loading-props renders each case and lists the size it drew or the error it
// threw.
test.describe("ProgressLoading props", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/progress-loading-props");
  });

  const outcome = (page: Page, name: string) =>
    page.getByTestId(`progress-loading-props-${name}`);

  test("reads a size given as text, as MDX passes it", async ({ page }) => {
    await expect(outcome(page, "size-as-text")).toHaveText("rendered 96px");
  });

  test("throws on a size outside M3's 24px to 240px, or not a number", async ({
    page,
  }) => {
    for (const [name, size] of [
      ["size-too-small", "12"],
      ["size-too-large", "320"],
      ["size-not-a-number", "big"],
    ]) {
      await expect(outcome(page, name)).toHaveText(
        `ProgressLoading: M3's loading indicators are 24 to 240px, but this one's \`size\` is ${size}.`
      );
    }
  });
});
