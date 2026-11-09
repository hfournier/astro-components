// PROTOTYPE (issue #290), throwaway: freezes the three indicators of prototype-290-progress-loading
// at the same times, pixel-diffs SMIL's and CSS's frames against the current loop's, and writes
// prototype-290-results-<browser>.json beside it. Asserts nothing.
// Run: ASTRO_DEV_BACKGROUND=1 pnpm exec playwright test src/pages/tests/prototype-290.spec.ts --reporter=list
import { test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Diff = { union: number; xor: number; mismatch: number };

const frames = (page: Page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  );
// A page screenshot clipped to the box: locator.screenshot() waits for the element to be stable,
// which a spinning indicator never is
const shot = async (page: Page, variant: string) => {
  const clip = (await page.locator(`[data-variant=${variant}]`).boundingBox())!;
  return (
    "data:image/png;base64," +
    (await page.screenshot({ clip, timeout: 10_000 })).toString("base64")
  );
};
const diff = (page: Page, a: string, b: string) =>
  page.evaluate(
    ([a, b]) =>
      (window as unknown as { diffPngs: (a: string, b: string) => Promise<Diff> }).diffPngs(a, b),
    [a, b]
  );

test("measure", async ({ page, browserName }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1000, height: 500 });
  const result: Record<string, unknown> = { browser: browserName };

  // Live: does each variant move on its own, without the scrubber?
  await page.goto("/tests/prototype-290-progress-loading");
  await page.waitForTimeout(500);
  const live: Record<string, boolean> = {};
  const before = { smil: await shot(page, "smil"), css: await shot(page, "css") };
  await page.waitForTimeout(170);
  for (const v of ["smil", "css"] as const)
    live[v] = (await diff(page, before[v], await shot(page, v))).xor > 0;
  result.live = live;
  result.sizes = await page.evaluate(() => (window as unknown as { prototypeSizes: unknown }).prototypeSizes);

  // Scrubbed: every PROTO_STEP ms (default 37) over two shape cycles (14 morphs, 3.5 turns)
  await page.locator("#scrub").check();
  const rows: { ms: number; smil: number; css: number }[] = [];
  const step = Number(process.env.PROTO_STEP ?? 37);
  const until = Number(process.env.PROTO_UNTIL ?? 9100);
  for (let ms = 0; ms <= until; ms += step) {
    await page.evaluate((ms) => (window as unknown as { setTime: (n: number) => void }).setTime(ms), ms);
    await frames(page);
    const current = await shot(page, "current");
    const smil = (await diff(page, current, await shot(page, "smil"))).mismatch;
    const css = (await diff(page, current, await shot(page, "css"))).mismatch;
    rows.push({ ms, smil, css });
  }
  const stats = (key: "smil" | "css") => {
    const sorted = rows.map((r) => r[key]).sort((a, b) => a - b);
    const worst = [...rows].sort((a, b) => b[key] - a[key]).slice(0, 8);
    return {
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      max: sorted.at(-1),
      worst: worst.map((r) => ({ ms: r.ms, phaseMs: r.ms % 650, mismatch: r[key] })),
    };
  };
  result.scrubbed = { samples: rows.length, smil: stats("smil"), css: stats("css") };

  // Reduced motion: each shows the static first frame, the current loop's frame at 0
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/prototype-290-progress-loading");
  await page.waitForTimeout(400);
  const still = await shot(page, "current");
  const reduced: Record<string, unknown> = {};
  for (const v of ["smil", "css"] as const) {
    const a = await shot(page, v);
    await page.waitForTimeout(300);
    reduced[v] = {
      mismatchWithFirstFrame: (await diff(page, still, a)).mismatch,
      moved: (await diff(page, a, await shot(page, v))).xor > 0,
    };
  }
  result.reducedMotion = reduced;

  writeFileSync(
    fileURLToPath(new URL(`./prototype-290-results-${browserName}.json`, import.meta.url)),
    JSON.stringify({ ...result, rows }, null, 1)
  );
});
