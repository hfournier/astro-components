import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { css, elevation, radii } from "./support/helpers";

// Each case on /tests/carousel is a Section with data-testid="carousel-<caseId>"
type CarouselCaseId = "multi-browse" | "wide" | "label" | "buttons" | "rtl";

const section = (page: Page, caseId: CarouselCaseId) =>
  page.getByTestId(`carousel-${caseId}`);
const carousel = (page: Page, caseId: CarouselCaseId) =>
  section(page, caseId).getByRole("region");
const listOf = (page: Page, caseId: CarouselCaseId) =>
  carousel(page, caseId).getByRole("list");
const items = (page: Page, caseId: CarouselCaseId) =>
  carousel(page, caseId).locator('[data-ac-carousel-item-part="item"]');

type Box = { x: number; y: number; width: number; height: number };

// An element's box from its carousel's top-left corner
const boxIn = (target: Locator) =>
  target.evaluate((el) => {
    const root = el.closest("[data-ac-carousel]")!.getBoundingClientRect();
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x: x - root.x, y: y - root.y, width, height };
  });

// The items any part of which shows in the carousel, in order
const visibleBoxes = async (page: Page, caseId: CarouselCaseId) => {
  const width = (await carousel(page, caseId).boundingBox())!.width;
  const boxes: Box[] = [];
  for (const item of await items(page, caseId).all()) {
    const b = await boxIn(item);
    if (b.x + b.width > 0.5 && b.x < width - 0.5) boxes.push(b);
  }
  return boxes;
};

// Waits until the row has stopped scrolling, snapping included, over several frames, as a slow
// machine can take a while to start a smooth scroll
const settle = (list: Locator) =>
  list.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        let last = NaN;
        let still = 0;
        const started = performance.now();
        const check = () => {
          if (el.scrollLeft === last) still++;
          else still = 0;
          last = el.scrollLeft;
          if (still >= 10 || performance.now() - started > 3000) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      })
  );

const itemSize = (list: Locator) =>
  list.evaluate((el) =>
    parseFloat(getComputedStyle(el).getPropertyValue("--ac-carousel-item-size"))
  );

test.describe("Carousel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/carousel");
  });

  // M3's Accessibility page: the container is labelled, and says how many items there are and
  // which one has focus; each item is named and activates. Here, a region described as a
  // carousel, with a list of links.
  test("is a region described as a carousel, with a list of named items", async ({
    page,
  }) => {
    const region = page.getByRole("region", { name: "Trip photos" });
    await expect(region).toHaveAttribute("aria-roledescription", "carousel");
    await expect(region.getByRole("listitem")).toHaveCount(8);
    await expect(
      region.getByRole("link", { name: "Lake at sunrise" })
    ).toHaveAttribute("href", "#lake");
    await expect(
      page.getByRole("region", { name: "Filters" }).getByRole("button")
    ).toHaveCount(5);
  });

  // M3's Specs: the multi-browse layout shows large, medium and small items, 8dp apart, 16dp
  // from the container's ends and 8dp from its top and bottom, with 28dp corners. Compose's
  // arrangement fits two large items and a small one in 412dp. At the start, the leading padding
  // comes out of the three items' sizes, and the small one reaches the carousel's end.
  test("lays its items out large, large and small, 8px apart, 16px in", async ({
    page,
  }) => {
    const boxes = await visibleBoxes(page, "multi-browse");
    expect(boxes).toHaveLength(3);
    const [a, b, c] = boxes;
    expect(a.x).toBeCloseTo(16, 0);
    expect(b.x - (a.x + a.width)).toBeCloseTo(8, 0);
    expect(c.x - (b.x + b.width)).toBeCloseTo(8, 0);
    expect(c.x + c.width).toBeCloseTo(412, 0);
    expect(a.width).toBeCloseTo(b.width, 1);
    expect(a.width).toBeGreaterThan(150);
    expect(c.width).toBeLessThan(56);
    for (const box of boxes) {
      expect(box.y).toBe(8);
      expect(box.height).toBe(221 - 16);
    }
    for (const radius of await radii(items(page, "multi-browse").first()))
      expect(radius).toBe("28px");
  });

  // M3's Guidelines: on larger screens, more large and medium items show
  test("shows more items, a medium one too, when it's wider", async ({
    page,
  }) => {
    const widths = (await visibleBoxes(page, "wide")).map((b) => b.width);
    expect(widths.length).toBeGreaterThanOrEqual(4);
    const [large, , medium, small] = widths.slice(-4);
    expect(large).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(small + 20);
  });

  // M3's Guidelines: items snap into place when scrolled, and change size as they move
  test("snaps, its items growing as they come into place", async ({ page }) => {
    const list = listOf(page, "multi-browse");
    const large = await itemSize(list);
    // a short scroll snaps back to the nearest snap position (a scrollBy would snap onward, in
    // its direction)
    await list.evaluate((el) => el.scrollTo({ left: 30, behavior: "instant" }));
    await settle(list);
    expect(await list.evaluate((el) => el.scrollLeft)).toBe(0);
    // one item's worth moves the next large one to the start, flush with the edge mid-scroll
    await list.evaluate(
      (el, by) => el.scrollBy({ left: by, behavior: "instant" }),
      large + 8
    );
    await settle(list);
    const [a, b, c] = await visibleBoxes(page, "multi-browse");
    expect(a.x).toBeCloseTo(0, 0);
    expect(a.width).toBeCloseTo(large, 0);
    expect(b.width).toBeCloseTo(large, 0);
    expect(c.width).toBeGreaterThanOrEqual(40);
    expect(c.width).toBeLessThanOrEqual(56);
  });

  test("ends with its last items large, 16px from its end", async ({
    page,
  }) => {
    const list = listOf(page, "multi-browse");
    await list.evaluate((el) =>
      el.scrollTo({ left: 1e5, behavior: "instant" })
    );
    await settle(list);
    const boxes = await visibleBoxes(page, "multi-browse");
    const last = boxes.at(-1)!;
    expect(last.x + last.width).toBeCloseTo(412 - 16, 0);
    expect(last.width).toBeGreaterThan(150);
    expect(boxes.at(-2)!.width).toBeCloseTo(last.width, 1);
    expect(boxes[0].width).toBeLessThan(56);
  });

  // M3's Overview: item visuals have a parallax effect. The visual stays at the large size,
  // centered on the item, so the item's edges move over it as it changes size.
  test("keeps its visuals large, moving at another speed than the items' edges", async ({
    page,
  }) => {
    const list = listOf(page, "multi-browse");
    const large = await itemSize(list);
    const third = items(page, "multi-browse").nth(2);
    const visual = third.locator('[data-ac-carousel-item-part="visual"]');
    const item = await boxIn(third);
    const seen = await boxIn(visual);
    expect(seen.width).toBeCloseTo(large, 0);
    expect(seen.x + seen.width / 2).toBeCloseTo(item.x + item.width / 2, 0);

    // without snapping, scroll part way: the item's start edge and its visual move apart
    await list.evaluate((el) => {
      el.style.scrollSnapType = "none";
      el.scrollBy({ left: 60, behavior: "instant" });
    });
    await settle(list);
    const movedItem = await boxIn(third);
    const movedVisual = await boxIn(visual);
    expect(movedItem.x - item.x).not.toBeCloseTo(movedVisual.x - seen.x, 0);
  });

  // M3's Guidelines: brief text over the visual, which adapts to the item's size. It sits at
  // the item's start and fades as the item shrinks, as MDC's carousel's does.
  test("shows item text at its start, light on a scrim, fading on a small item", async ({
    page,
  }) => {
    const labels = items(page, "label").locator(
      '[data-ac-carousel-item-part="label"]'
    );
    const first = labels.first();
    await expect(first).toHaveText("Lake Louise");
    expect(await css(first, "color")).toBe("rgb(255, 255, 255)");
    // nearly 1: the leading padding takes a few px off the large item at the start
    expect(Number(await css(first, "opacity"))).toBeGreaterThan(0.9);
    expect(await css(first, "background-image")).toContain("linear-gradient");
    const [label, item] = await Promise.all([
      boxIn(first),
      boxIn(items(page, "label").first()),
    ]);
    expect(label.x).toBeCloseTo(item.x, 0);
    expect(label.y + label.height).toBeCloseTo(item.y + item.height, 0);
    expect(Number(await css(labels.nth(2), "opacity"))).toBeLessThan(0.5);
    // it's part of the item's name
    await expect(
      section(page, "label").getByRole("link", { name: "Black Forest" })
    ).toBeVisible();
  });

  // M3's Accessibility page: Tab puts focus on the first item, then Tab or the arrow keys move
  // between items, and the up and down arrows leave the carousel. Tab is checked on the button
  // items, as WebKit's Tab skips links by default, as Safari's does.
  test("moves between items with Tab and the arrow keys, and leaves with up and down", async ({
    page,
  }) => {
    const filters = carousel(page, "buttons");
    await section(page, "buttons").getByRole("heading").click();
    await page.keyboard.press("Tab");
    await expect(filters.getByRole("button", { name: "Warm" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(filters.getByRole("button", { name: "Cool" })).toBeFocused();

    const region = carousel(page, "multi-browse");
    const before = page.getByRole("button", { name: "Before the carousel" });
    const after = page.getByRole("button", { name: "After the carousel" });
    await region.getByRole("link", { name: "Forest trail" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      region.getByRole("link", { name: "Desert dunes" })
    ).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(
      region.getByRole("link", { name: "Forest trail" })
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(after).toBeFocused();
    await region.getByRole("link", { name: "Forest trail" }).focus();
    await page.keyboard.press("ArrowUp");
    await expect(before).toBeFocused();
  });

  // An item that takes focus while it's small scrolls into place, large, so it can be seen
  test("scrolls a focused item into place", async ({ page }) => {
    const list = listOf(page, "multi-browse");
    const large = await itemSize(list);
    const desert = carousel(page, "multi-browse").getByRole("link", {
      name: "Desert dunes",
    });
    expect((await boxIn(desert)).width).toBeLessThan(56);
    await desert.focus();
    await settle(list);
    expect((await boxIn(desert)).width).toBeCloseTo(large, 0);
    expect((await boxIn(desert)).x).toBeGreaterThanOrEqual(0);
  });

  // M3's Specs: a 3dp focus indicator 2dp outside the item
  test("shows a focus ring on the focused item", async ({ page }) => {
    await section(page, "buttons").getByRole("heading").click();
    await page.keyboard.press("Tab");
    const item = items(page, "buttons").first();
    expect(await css(item, "outline-width")).toBe("3px");
    expect(await css(item, "outline-offset")).toBe("2px");
    expect(await css(item, "outline-style")).toBe("solid");
  });

  // M3's Specs: hovered, an 8% state layer and elevation level 1
  test("shows the hover state layer and raises the item", async ({ page }) => {
    const item = items(page, "multi-browse").first();
    await item.hover();
    await expect
      .poll(() =>
        item.evaluate((el) => getComputedStyle(el, "::before").opacity)
      )
      .toBe("0.08");
    await expect
      .poll(() => css(item, "box-shadow"))
      .toContain(await elevation(page, 1));
  });

  // M3's Specs: a disabled item's container at 38%. The arrow keys skip it, as Tab does.
  test("dims a disabled button item, which the arrow keys skip", async ({
    page,
  }) => {
    const region = carousel(page, "buttons");
    const vivid = region.getByRole("button", { name: "Vivid" });
    await expect(vivid).toBeDisabled();
    expect(await css(vivid, "opacity")).toBe("0.38");
    await region.getByRole("button", { name: "Cool" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(region.getByRole("button", { name: "Muted" })).toBeFocused();
  });

  // M3's Accessibility page: with reduced motion, there's no parallax and the items don't
  // change size: all are the same size, and the row reaches its edges
  test("keeps every item the same size with reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const boxes = await visibleBoxes(page, "multi-browse");
    expect(boxes[0].x).toBeCloseTo(16, 0);
    for (const box of boxes.slice(0, 2)) expect(box.width).toBeCloseTo(186, 0);
    // the last one shows only in part, cut off at the carousel's end
    expect(boxes.at(-1)!.x + boxes.at(-1)!.width).toBeGreaterThan(412);
    const visual = items(page, "multi-browse")
      .first()
      .locator('[data-ac-carousel-item-part="visual"]');
    expect((await boxIn(visual)).x).toBeCloseTo(16, 0);
  });

  // Right to left, the row starts at the right, and the arrow keys mirror
  test("mirrors right to left", async ({ page }) => {
    const region = carousel(page, "rtl");
    const boxes = await visibleBoxes(page, "rtl");
    expect(boxes).toHaveLength(3);
    const [a, b, c] = boxes;
    expect(a.x + a.width).toBeCloseTo(412 - 16, 0);
    expect(a.x - (b.x + b.width)).toBeCloseTo(8, 0);
    expect(c.width).toBeLessThan(56);
    expect(c.x).toBeCloseTo(0, 0);
    await region.getByRole("link", { name: "بحيرة" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(region.getByRole("link", { name: "غابة" })).toBeFocused();

    const list = listOf(page, "rtl");
    await list.evaluate((el) =>
      el.scrollTo({ left: -1e5, behavior: "instant" })
    );
    await settle(list);
    const end = await visibleBoxes(page, "rtl");
    expect(end.at(-1)!.x).toBeCloseTo(16, 0);
    expect(end.at(-1)!.width).toBeGreaterThan(150);
  });
});
