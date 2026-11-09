// PROTOTYPE (issue #289), throwaway: measures prototype-289-anchor-sizing in each engine and
// writes the numbers to prototype-289-results-<browser>.json beside it. Not a test: it asserts
// nothing. Run: pnpm exec playwright test src/pages/tests/prototype-289.spec.ts --reporter=list
import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Row = Record<string, unknown>;

const url = (p: Record<string, string | number>) =>
  "/tests/prototype-289-anchor-sizing?" +
  new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)]));

test("measure", async ({ page, browserName }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const rows: Row[] = [];
  // two frames and 300ms, so a late layout (after scroll, say) shows
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))
        )
    );

  const run = async (
    label: string,
    params: Record<string, string | number>,
    scrollAmount?: number
  ) => {
    await page.goto(url(params));
    await page.evaluate(() => {
      const list = document.querySelector<HTMLElement>(
        new URLSearchParams(location.search).get("case") === "fab"
          ? "#fab-list"
          : "#menu"
      )!;
      list.showPopover({ source: document.getElementById("trigger")! } as never);
    });
    await settle();
    const opened = await page.evaluate(() => (window as never as { measure: () => Row }).measure());
    rows.push({ label, phase: "opened", ...opened });
    if (scrollAmount !== undefined) {
      await page.evaluate((by) => window.scrollBy(0, by), scrollAmount);
      await settle();
      const after = await page.evaluate(() =>
        (window as never as { measure: () => Row }).measure()
      );
      rows.push({ label, phase: `scrolled ${scrollAmount}`, ...after });
    }
  };

  // Menu: near the top, the middle and the bottom of a 720px window
  for (const size of ["none", "stretch"])
    for (const order of ["most", "none"])
      for (const items of [3, 30])
        for (const y of [40, 340, 620])
          await run(`menu y=${y}`, { case: "menu", y, items, size, order });

  // Menu, opened near the bottom (so above), then the page scrolls it to the top; and back
  for (const size of ["none", "stretch"])
    for (const order of ["most", "none"]) {
      await run(`menu y=620 → 60`, { case: "menu", y: 620, items: 30, size, order }, 560);
      await run(`menu y=60 → 620`, { case: "menu", y: 60, items: 30, size, order }, -560);
    }

  // FabMenu: FAB near the bottom, in the middle and near the top; scrolling with the page or fixed
  for (const size of ["none", "stretch", "stretch-min", "fill"])
    for (const fixed of [0, 1])
      for (const items of [3, 30])
        for (const y of [600, 150, 30])
          await run(`fab y=${y}`, { case: "fab", y, items, size, fixed });

  // FabMenu open while the page scrolls (Firefox's suspected shift with the anchor's scrolling)
  for (const size of ["none", "stretch", "fill"]) {
    await run(`fab y=600 scroll`, { case: "fab", y: 600, items: 30, size }, 300);
    await run(`fab y=300 scroll`, { case: "fab", y: 300, items: 30, size }, -250);
  }

  // With the page unscrolled, to tell Firefox's scroll offset apart from its sizing
  for (const size of ["none", "stretch"]) {
    for (const y of [40, 620])
      await run(`menu y=${y} unscrolled`, {
        case: "menu", y, items: 30, size, order: "most", scroll: 0,
      });
    for (const y of [600, 150])
      await run(`fab y=${y} unscrolled`, { case: "fab", y, items: 30, size, scroll: 0 });
  }

  const out = fileURLToPath(
    new URL(`./prototype-289-results-${browserName}.json`, import.meta.url)
  );
  writeFileSync(out, JSON.stringify(rows, null, 1));
});
