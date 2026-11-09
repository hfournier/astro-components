// PROTOTYPE (issue #298), throwaway: freezes every scenario of prototype-298-translated-wave at the
// same times, compares the clip and dash layers with the current loop's frame, and writes
// prototype-298-results-<browser>.json beside it. Asserts nothing.
// Run: ASTRO_DEV_BACKGROUND=1 pnpm exec playwright test src/pages/tests/prototype-298.spec.ts --project=chromium --reporter=list
import { test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const deviceScale = Number(process.env.PROTO_SCALE ?? 2);
test.use({ viewport: { width: 2300, height: 1000 }, deviceScaleFactor: deviceScale });

type Box = { x: number; y: number; w: number; h: number };
type Region = { id: string; until: number; current: Box; clip: Box; dash: Box };
type Score = { mismatch: number; peak: number };
type Compared = Record<string, { clip: Score; dash: Score }>;

// Runs in a blank page. Coverage is 1 - red, since it's black on white. For each pair of boxes:
//   mismatch: the summed coverage difference, as a share of the area either covers
//   peak: the largest average difference over any 1 CSS px square. A full CSS px wrong is 1, and an
//         edge a quarter pixel out about 0.25, so this catches a local error that mismatch averages
//         away: a wrong cap on a long line
const compare = async ({
  png,
  regions,
  scale,
}: {
  png: string;
  regions: Region[];
  scale: number;
}): Promise<Compared> => {
  const image = new Image();
  await new Promise((resolve) => {
    image.onload = resolve;
    image.src = "data:image/png;base64," + png;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const coverage = (box: Box) => {
    const w = Math.round(box.w * scale);
    const h = Math.round(box.h * scale);
    const { data } = context.getImageData(
      Math.round(box.x * scale),
      Math.round(box.y * scale),
      w,
      h
    );
    const out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) out[i] = 1 - data[i * 4] / 255;
    return { out, w, h };
  };
  const score = (a: Box, b: Box): Score => {
    const ca = coverage(a);
    const cb = coverage(b);
    const { w, h } = ca;
    let union = 0;
    let difference = 0;
    const integral = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const av = ca.out[y * w + x];
        const bv = cb.out[y * w + x];
        const d = Math.abs(av - bv);
        union += Math.max(av, bv);
        difference += d;
        integral[(y + 1) * (w + 1) + x + 1] =
          d +
          integral[y * (w + 1) + x + 1] +
          integral[(y + 1) * (w + 1) + x] -
          integral[y * (w + 1) + x];
      }
    }
    let peak = 0;
    for (let y = 0; y + scale <= h; y++) {
      for (let x = 0; x + scale <= w; x++) {
        const sum =
          integral[(y + scale) * (w + 1) + x + scale] -
          integral[y * (w + 1) + x + scale] -
          integral[(y + scale) * (w + 1) + x] +
          integral[y * (w + 1) + x];
        peak = Math.max(peak, sum / (scale * scale));
      }
    }
    return { mismatch: union ? difference / union : 0, peak };
  };
  const result: Compared = {};
  for (const r of regions)
    result[r.id] = {
      clip: score(r.current, r.clip),
      dash: score(r.current, r.dash),
    };
  return result;
};

const frames = (page: Page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  );
const shot = async (page: Page) =>
  (await page.screenshot({ fullPage: true, timeout: 60_000 })).toString("base64");

const times = () => {
  const out: number[] = [];
  for (let ms = 0; ms < 1000; ms += 13) out.push(ms);
  for (let ms = 1000; ms <= 6000; ms += 37) out.push(ms);
  return out;
};

const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const rounded = (n: number) => Math.round(n * 10000) / 10000;
  return {
    median: rounded(sorted[Math.floor(sorted.length / 2)]),
    p95: rounded(sorted[Math.floor(sorted.length * 0.95)]),
    max: rounded(sorted.at(-1)!),
  };
};

test("measure", async ({ page, browser, browserName }) => {
  test.setTimeout(1_800_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tests/prototype-298-translated-wave");
  const blank = await page.context().newPage();
  await blank.goto("about:blank");
  const regions: Region[] = await page.evaluate(() =>
    (window as unknown as { regions: () => Region[] }).regions()
  );
  const compareShot = (png: string, subset: Region[]) =>
    blank.evaluate(compare, { png, regions: subset, scale: deviceScale });

  // Live: with nothing scrubbing and no script touching them, does each CSS layer move?
  await page.waitForTimeout(300);
  const a = await shot(page);
  await page.waitForTimeout(170);
  const b = await shot(page);
  const moved = await blank.evaluate(
    async ({ a, b, regions, scale }) => {
      const load = async (src: string) => {
        const image = new Image();
        await new Promise((r) => {
          image.onload = r;
          image.src = "data:image/png;base64," + src;
        });
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        const x = c.getContext("2d")!;
        x.drawImage(image, 0, 0);
        return x;
      };
      const [ca, cb] = [await load(a), await load(b)];
      const changed = (box: Box) => {
        const args = [box.x * scale, box.y * scale, box.w * scale, box.h * scale].map(
          Math.round
        ) as [number, number, number, number];
        const da = ca.getImageData(...args).data;
        const db = cb.getImageData(...args).data;
        for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i]) return true;
        return false;
      };
      return Object.fromEntries(
        regions.map((r) => [r.id, { clip: changed(r.clip), dash: changed(r.dash) }])
      );
    },
    { a, b, regions, scale: deviceScale }
  );

  // Scrubbed
  await page.evaluate(() => (window as unknown as { enterScrub: () => void }).enterScrub());
  const samples: Record<string, { clip: Score[]; dash: Score[]; worst: { ms: number; dash: Score }[] }> = {};
  for (const r of regions) samples[r.id] = { clip: [], dash: [], worst: [] };
  for (const ms of times()) {
    const due = regions.filter((r) => ms <= r.until);
    if (!due.length) break;
    await page.evaluate(
      (ms) => (window as unknown as { setTime: (n: number) => void }).setTime(ms),
      ms
    );
    await frames(page);
    const compared = await compareShot(await shot(page), due);
    for (const r of due) {
      samples[r.id].clip.push(compared[r.id].clip);
      samples[r.id].dash.push(compared[r.id].dash);
      samples[r.id].worst.push({ ms, dash: compared[r.id].dash });
    }
  }

  const scenarios = Object.fromEntries(
    Object.entries(samples).map(([id, s]) => [
      id,
      {
        samples: s.dash.length,
        moved: moved[id],
        clip: {
          mismatch: stats(s.clip.map((x) => x.mismatch)),
          peak: stats(s.clip.map((x) => x.peak)),
        },
        dash: {
          mismatch: stats(s.dash.map((x) => x.mismatch)),
          peak: stats(s.dash.map((x) => x.peak)),
        },
        worstDashFrames: [...s.worst].sort((a, b) => b.dash.peak - a.dash.peak).slice(0, 3),
        worstDashMismatchFrames: [...s.worst].sort((a, b) => b.dash.mismatch - a.dash.mismatch).slice(0, 3),
      },
    ])
  );

  writeFileSync(
    fileURLToPath(
      new URL(
        `./prototype-298-results-${browserName}${deviceScale === 2 ? "" : `-${deviceScale}x`}.json`,
        import.meta.url
      )
    ),
    JSON.stringify({ browser: browserName, version: browser.version(), errors, scenarios }, null, 1)
  );
});

// Writes one scenario's three layers at one time, enlarged, to PROTO_OUT, for looking at
test("debug", async ({ page }) => {
  test.skip(!process.env.PROTO_OUT, "only when asked for");
  await page.goto("/tests/prototype-298-translated-wave");
  await page.evaluate(() => (window as unknown as { enterScrub: () => void }).enterScrub());
  const ids = process.env.PROTO_IDS!.split(",");
  for (const ms of process.env.PROTO_MS!.split(",").map(Number)) {
    await page.evaluate(
      (ms) => (window as unknown as { setTime: (n: number) => void }).setTime(ms),
      ms
    );
    await frames(page);
    for (const id of ids) {
      const clip = (await page.locator(`[data-scenario="${id}"]`).boundingBox())!;
      await page.screenshot({
        fullPage: true,
        clip,
        path: `${process.env.PROTO_OUT}/${id}-${ms}.png`,
      });
      const state = await page.evaluate((id) => {
        const s = getComputedStyle(document.querySelector(`[data-scenario="${id}"]`)!);
        return ["phase", "head-1", "tail-1", "head-2", "tail-2", "amplitude", "progress"].map(
          (n) => `${n}=${s.getPropertyValue("--" + n)}`
        );
      }, id);
      console.log(id, ms, state.join(" "));
    }
  }
});

// Where each layer's ink starts and ends, the path's measure, and what transitions a change starts
test("probe", async ({ page, browserName }) => {
  test.skip(!process.env.PROTO_PROBE, "only when asked for");
  await page.goto("/tests/prototype-298-translated-wave");
  const blank = await page.context().newPage();
  await blank.goto("about:blank");
  const lengths = await page.evaluate(() =>
    ["l-steady-w640", "l-indeterminate"].map((id) => {
      const p = document.querySelector<SVGPathElement>(`[data-scenario="${id}"] .dashed`)!;
      const declared = Number(p.getAttribute("pathLength"));
      const total = p.getTotalLength();
      return { id, declared, total, perPx: total / declared };
    })
  );
  console.log(browserName, JSON.stringify(lengths));
  await page.evaluate(() => (window as unknown as { enterScrub: () => void }).enterScrub());
  console.log(
    browserName,
    "transitions",
    await page.evaluate(() =>
      [...document.querySelectorAll(".root[data-to]")].map(
        (r) =>
          `${(r as HTMLElement).dataset.scenario}: ${r
            .getAnimations()
            .map((a) => (a as CSSTransition).transitionProperty ?? "animation")
            .join(" ")}`
      )
    )
  );
  const regions: Region[] = await page.evaluate(() =>
    (window as unknown as { regions: () => Region[] }).regions()
  );
  for (const ms of [247, 273, 1666, 1703, 1740]) {
    await page.evaluate(
      (ms) => (window as unknown as { setTime: (n: number) => void }).setTime(ms),
      ms
    );
    await frames(page);
    const png = await shot(page);
    const extents = await blank.evaluate(
      async ({ png, regions, scale }) => {
        const image = new Image();
        await new Promise((r) => {
          image.onload = r;
          image.src = "data:image/png;base64," + png;
        });
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        const x = c.getContext("2d")!;
        x.drawImage(image, 0, 0);
        const extent = (b: Box) => {
          const w = Math.round(b.w * scale);
          const h = Math.round(b.h * scale);
          const d = x.getImageData(Math.round(b.x * scale), Math.round(b.y * scale), w, h).data;
          let min = Infinity;
          let max = -Infinity;
          let ink = 0;
          for (let i = 0; i < w * h; i++) {
            if (d[i * 4] < 128) {
              const col = i % w;
              min = Math.min(min, col);
              max = Math.max(max, col);
              ink++;
            }
          }
          return `${(min / scale - 4).toFixed(1)}..${(max / scale - 4).toFixed(1)} ink ${ink}`;
        };
        return regions
          .filter((r) => ["l-indeterminate", "l-steady-w640"].includes(r.id))
          .map((r) => `${r.id} cur ${extent(r.current)} | clip ${extent(r.clip)} | dash ${extent(r.dash)}`);
      },
      { png, regions, scale: deviceScale }
    );
    console.log(browserName, ms, extents.join("\n    "));
  }

  // A real, live transition: does the progress pass through values between its two ends?
  await page.goto("/tests/prototype-298-translated-wave");
  const live = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const root = document.querySelector<HTMLElement>(
          '[data-scenario="l-change-steady-amplitude"]'
        )!;
        getComputedStyle(root).getPropertyValue("--progress");
        root.style.setProperty("--value", "0.7");
        const seen: string[] = [];
        const start = performance.now();
        const tick = () => {
          seen.push(getComputedStyle(root).getPropertyValue("--progress").trim());
          if (performance.now() - start < 220) requestAnimationFrame(tick);
          else resolve(seen);
        };
        tick();
      })
  );
  console.log(browserName, "live --progress", live.slice(0, 14).join(" "));
});
