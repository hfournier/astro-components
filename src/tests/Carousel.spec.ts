import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  css,
  elevation,
  radii,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/carousel is a Section with data-testid="carousel-<caseId>"
type CarouselCaseId =
  | "multi-browse"
  | "wide"
  | "label"
  | "buttons"
  | "rtl"
  | "hero"
  | "hero-wide"
  | "centered"
  | "centered-rtl";

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

  // M3's Specs: the multi-browse layout "shows at least one large, medium, and small carousel
  // item", 8dp apart, 16dp from the container's ends and 8dp from its top and bottom, with 28dp
  // corners. Compose's arrangement would fit two large items and a small one in 412dp; the
  // Specs keep the medium one. At the start, the leading padding comes out of the large and
  // medium items' sizes, and the small one reaches the carousel's end.
  test("lays its items out large, medium and small, 8px apart, 16px in", async ({
    page,
  }) => {
    const boxes = await visibleBoxes(page, "multi-browse");
    expect(boxes).toHaveLength(3);
    const [a, b, c] = boxes;
    expect(a.x).toBeCloseTo(16, 0);
    expect(b.x - (a.x + a.width)).toBeCloseTo(8, 0);
    expect(c.x - (b.x + b.width)).toBeCloseTo(8, 0);
    expect(c.x + c.width).toBeCloseTo(412, 0);
    expect(a.width).toBeGreaterThan(150);
    expect(b.width).toBeLessThan(a.width - 20);
    expect(b.width).toBeGreaterThan(c.width + 20);
    expect(c.width).toBeLessThanOrEqual(56);
    expect(c.width).toBeGreaterThanOrEqual(40);
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
    // one item's worth moves the medium one to the start, large, flush with the edge
    // mid-scroll, and the small one to medium
    await list.evaluate(
      (el, by) => el.scrollBy({ left: by, behavior: "instant" }),
      large + 8
    );
    await settle(list);
    const [a, b, c] = await visibleBoxes(page, "multi-browse");
    expect(a.x).toBeCloseTo(0, 0);
    expect(a.width).toBeCloseTo(large, 0);
    expect(b.width).toBeLessThan(large - 20);
    expect(b.width).toBeGreaterThan(c.width + 20);
    expect(c.width).toBeGreaterThanOrEqual(40);
    // the large size, 194.8px here, puts the items' edges between pixels
    expect(c.width).toBeLessThanOrEqual(56.5);
  });

  // At the end, the keylines shift so the last item is large, the one before it medium
  test("ends with its last item large, 16px from its end", async ({ page }) => {
    const list = listOf(page, "multi-browse");
    await list.evaluate((el) =>
      el.scrollTo({ left: 1e5, behavior: "instant" })
    );
    await settle(list);
    const boxes = await visibleBoxes(page, "multi-browse");
    expect(boxes).toHaveLength(3);
    const last = boxes.at(-1)!;
    expect(last.x + last.width).toBeCloseTo(412 - 16, 0);
    expect(last.width).toBeGreaterThan(150);
    expect(boxes[1].width).toBeLessThan(last.width - 20);
    expect(boxes[1].width).toBeGreaterThan(boxes[0].width + 20);
    expect(boxes[0].width).toBeLessThanOrEqual(56);
    expect(boxes[0].width).toBeGreaterThanOrEqual(40);
  });

  // A small item moves toward the view, over the next item's large `<li>`, which mustn't take
  // its clicks
  test("takes clicks on every item it shows, small ones too", async ({
    page,
  }) => {
    for (const caseId of ["multi-browse", "wide"] as const) {
      const list = listOf(page, caseId);
      await list.scrollIntoViewIfNeeded();
      for (const left of [0, 1e5]) {
        await list.evaluate(
          (el, left) => el.scrollTo({ left, behavior: "instant" }),
          left
        );
        await settle(list);
        const hits = await list.evaluate((el) => {
          const row = el.getBoundingClientRect();
          return [
            ...el.querySelectorAll('[data-ac-carousel-item-part="item"]'),
          ].flatMap((item) => {
            const { x, y, width, height } = item.getBoundingClientRect();
            const cx = x + width / 2;
            if (cx < row.left || cx > row.right) return [];
            return [
              item.contains(document.elementFromPoint(cx, y + height / 2)),
            ];
          });
        });
        expect(hits.length).toBeGreaterThanOrEqual(3);
        expect(hits, `${caseId} scrolled to ${left}`).not.toContain(false);
      }
    }
    // the small first item at the end, clicked, scrolls into place, large, Safari too, which
    // doesn't focus it
    const list = listOf(page, "wide");
    const small = items(page, "wide").nth(6);
    expect((await small.boundingBox())!.width).toBeLessThanOrEqual(56);
    await small.click();
    await settle(list);
    expect((await small.boundingBox())!.width).toBeCloseTo(
      await itemSize(list),
      0
    );
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
    expect((await boxIn(desert)).width).toBeLessThanOrEqual(56);
    await desert.focus();
    await settle(list);
    expect((await boxIn(desert)).width).toBeCloseTo(large, 0);
    expect((await boxIn(desert)).x).toBeGreaterThanOrEqual(-0.5);
  });

  // Clicked, a medium or small item scrolls the least way to a place it's large: from the
  // start, the medium one moves one item on, to the large place; from the end, the small one
  // moves back. The large one, shrunk a little by the padding at the start, stays put.
  test("scrolls a clicked medium or small item to a large place", async ({
    page,
  }) => {
    const list = listOf(page, "multi-browse");
    const large = await itemSize(list);
    const all = items(page, "multi-browse");
    await all.nth(0).click();
    await settle(list);
    expect(await list.evaluate((el) => el.scrollLeft)).toBe(0);
    for (const index of [1, 2, 3]) {
      await all.nth(index).click();
      await settle(list);
      expect(await list.evaluate((el) => el.scrollLeft)).toBeCloseTo(
        index * (large + 8),
        0
      );
      const clicked = await boxIn(all.nth(index));
      expect(clicked.x).toBeCloseTo(0, 0);
      expect(clicked.width).toBeCloseTo(large, 0);
    }
    await list.evaluate((el) =>
      el.scrollTo({ left: 1e5, behavior: "instant" })
    );
    await settle(list);
    const before = await list.evaluate((el) => el.scrollLeft);
    await all.nth(5).click();
    await settle(list);
    expect((await boxIn(all.nth(5))).x).toBeCloseTo(0, 0);
    expect((await boxIn(all.nth(5))).width).toBeCloseTo(large, 0);
    expect(await list.evaluate((el) => el.scrollLeft)).toBeLessThan(before);
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

  // M3's Specs: the container is surface, in light and dark; focused, the state layer is
  // on-surface at 10%
  test("is on surface in light and dark, with a 10% state layer when focused", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      expect(
        await css(carousel(page, "multi-browse"), "background-color")
      ).toBe(await resolvedColor(page, "var(--theme-color-surface)"));
      const item = items(page, "buttons").first();
      expect(
        await item.evaluate(
          (el) => getComputedStyle(el, "::before").backgroundColor
        )
      ).toBe(await resolvedColor(page, "var(--theme-color-on-surface)"));
    }
    await section(page, "buttons").getByRole("heading").click();
    await page.keyboard.press("Tab");
    const focused = items(page, "buttons").first();
    await expect
      .poll(() =>
        focused.evaluate((el) => getComputedStyle(el, "::before").opacity)
      )
      .toBe("0.1");
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
    expect(b.width).toBeLessThan(a.width - 20);
    expect(c.width).toBeLessThanOrEqual(56);
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

// Focuses a case's item, which scrolls it to a large place, and waits for the row to settle
const focusItem = async (page: Page, caseId: CarouselCaseId, index: number) => {
  await items(page, caseId).nth(index).focus();
  await settle(listOf(page, caseId));
};

// The edges of an item at the large size can fall between pixels
const isSmall = (box: Box) => box.width >= 40 && box.width <= 56.5;

test.describe("Carousel, hero layouts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/carousel");
  });

  // M3's Specs: the hero layout "shows at least one large item and one small item", 16dp in,
  // 8dp apart, with 28dp corners. M3's Guidelines: at a compact size, one large item and one
  // small one. Without a preferred width, the large item fills the rest.
  test("shows one large item and a small one", async ({ page }) => {
    const boxes = await visibleBoxes(page, "hero");
    expect(boxes).toHaveLength(2);
    const [large, small] = boxes;
    expect(large.x).toBeCloseTo(16, 0);
    expect(small.x - (large.x + large.width)).toBeCloseTo(8, 0);
    expect(small.x + small.width).toBeCloseTo(412, 0);
    expect(isSmall(small)).toBe(true);
    expect(large.width).toBeGreaterThan(300);
    for (const box of boxes) {
      expect(box.y).toBe(8);
      expect(box.height).toBe(221 - 16);
    }
    for (const radius of await radii(items(page, "hero").first()))
      expect(radius).toBe("28px");
  });

  // M3's Guidelines: "On larger screens, more large items are visible"
  test("shows more large items when it's wider", async ({ page }) => {
    const boxes = await visibleBoxes(page, "hero-wide");
    const large = await itemSize(listOf(page, "hero-wide"));
    expect(boxes.filter((b) => b.width > large - 20).length).toBeGreaterThan(1);
    expect(isSmall(boxes.at(-1)!)).toBe(true);
  });

  // M3's Specs: center-aligned hero "shows at least one large item and two small items". At the
  // start, its first item is large at the start, as Compose's: item 1 selected, [1][2][3].
  test("centers the large item between two small ones", async ({ page }) => {
    const start = await visibleBoxes(page, "centered");
    expect(start).toHaveLength(3);
    expect(start[0].x).toBeCloseTo(16, 0);
    expect(start[0].width).toBeGreaterThan(200);
    expect(isSmall(start[1])).toBe(true);
    expect(isSmall(start[2])).toBe(true);
    expect(start[2].x + start[2].width).toBeCloseTo(412, 0);

    const large = await itemSize(listOf(page, "centered"));
    await focusItem(page, "centered", 2);
    const [before, centered, after] = await visibleBoxes(page, "centered");
    expect(centered.width).toBeCloseTo(large, 0);
    expect(centered.x + centered.width / 2).toBeCloseTo(412 / 2, 0);
    expect(isSmall(before)).toBe(true);
    expect(isSmall(after)).toBe(true);
    expect(centered.x - (before.x + before.width)).toBeCloseTo(8, 0);
    expect(after.x - (centered.x + centered.width)).toBeCloseTo(8, 0);
    expect(before.x).toBeCloseTo(0, 0);
    expect(after.x + after.width).toBeCloseTo(412, 0);
  });

  // At the end, the last item is large, 16dp from the end, as Compose's: [3][4][5]
  test("ends with its last item large, 16px from its end", async ({ page }) => {
    for (const caseId of ["hero", "centered"] as const) {
      const list = listOf(page, caseId);
      await list.evaluate((el) =>
        el.scrollTo({ left: 1e5, behavior: "instant" })
      );
      await settle(list);
      const last = (await visibleBoxes(page, caseId)).at(-1)!;
      expect(last.x + last.width, caseId).toBeCloseTo(412 - 16, 0);
      expect(last.width, caseId).toBeGreaterThan(200);
    }
  });

  // M3's Overview: "Hero carousels swipe through one item at a time". Each item is a snap stop
  // the row doesn't scroll past; multi-browse's scroll through many at once.
  test("stops at every item, so a swipe moves it one item", async ({
    page,
  }) => {
    const li = (caseId: CarouselCaseId) =>
      listOf(page, caseId).getByRole("listitem").first();
    expect(await css(li("hero"), "scroll-snap-stop")).toBe("always");
    expect(await css(li("centered"), "scroll-snap-stop")).toBe("always");
    expect(await css(li("multi-browse"), "scroll-snap-stop")).toBe("normal");
  });

  // Each step on, the next item takes the large place, one item at a time
  test("moves one item at a time with the arrow keys", async ({ page }) => {
    const large = await itemSize(listOf(page, "hero"));
    const all = items(page, "hero");
    await all.first().focus();
    for (const index of [1, 2, 3]) {
      await page.keyboard.press("ArrowRight");
      await expect(all.nth(index)).toBeFocused();
      await settle(listOf(page, "hero"));
      const box = await boxIn(all.nth(index));
      expect(box.width).toBeCloseTo(large, 0);
      expect(box.x).toBeCloseTo(0, 0);
    }
  });

  // A small item, clicked, scrolls one item on, to the large place
  test("scrolls a clicked small item to the large place", async ({ page }) => {
    const large = await itemSize(listOf(page, "centered"));
    const all = items(page, "centered");
    await all.nth(1).click();
    await settle(listOf(page, "centered"));
    expect((await boxIn(all.nth(1))).width).toBeCloseTo(large, 0);
    await focusItem(page, "centered", 2);
    await all.nth(3).click();
    await settle(listOf(page, "centered"));
    const box = await boxIn(all.nth(3));
    expect(box.width).toBeCloseTo(large, 0);
    expect(box.x + box.width / 2).toBeCloseTo(412 / 2, 0);
  });

  // M3's Accessibility page: with reduced motion, items are all the same size, and "for hero
  // carousels ... the small carousel item is only partially shown on screen"
  test("keeps the items one size with reduced motion, the next shown in part", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const [first, next] = await visibleBoxes(page, "hero");
    expect(first.x).toBeCloseTo(16, 0);
    expect(next.width).toBeCloseTo(first.width, 0);
    // the large item at its arranged size, so the next shows past the 16px padding
    expect(next.x).toBeLessThan(412 - 16);
    expect(next.x + next.width).toBeGreaterThan(412);

    // a center-aligned one snaps its items to the center
    await focusItem(page, "centered", 2);
    const centered = await boxIn(items(page, "centered").nth(2));
    expect(centered.x + centered.width / 2).toBeCloseTo(412 / 2, 0);
    const boxes = await visibleBoxes(page, "centered");
    expect(boxes).toHaveLength(3);
    for (const box of boxes) expect(box.width).toBeCloseTo(centered.width, 0);
  });

  // Right to left, the row starts at the right, and the large item is centered as it moves
  test("mirrors right to left", async ({ page }) => {
    const start = await visibleBoxes(page, "centered-rtl");
    expect(start).toHaveLength(3);
    const first = start.find((b) => b.width > 200)!;
    expect(first.x + first.width).toBeCloseTo(412 - 16, 0);
    expect(start.find((b) => b.x < 1)).toBeDefined();

    const region = carousel(page, "centered-rtl");
    await region.getByRole("link").first().focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    const third = region.getByRole("link").nth(2);
    await expect(third).toBeFocused();
    await settle(listOf(page, "centered-rtl"));
    const box = await boxIn(third);
    expect(box.width).toBeGreaterThan(200);
    expect(box.x + box.width / 2).toBeCloseTo(412 / 2, 0);
  });
});
