import { test, expect } from "@playwright/test";
import {
  arrangeHero,
  arrangeMultiBrowse,
  createStrategy,
  itemPlacement,
  keylineListOf,
  keylinesForScroll,
  scrollToShow,
  snapOffset,
  type KeylineList,
} from "../carousel";

// The carousel's layout math, ported from Compose's (androidx.compose.material3.carousel), checked
// against the cases in Compose's own unit tests: MultiBrowseTest, CenteredHeroTest, StrategyTest
// and KeylineSnapPositionTest. It's pure, so it runs once, outside a browser.
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "pure functions, the same in every browser"
);

const sizes = (list: KeylineList) => list.map((k) => k.size);
const offsets = (list: KeylineList) => list.map((k) => k.offset);
const unadjusted = (list: KeylineList) => list.map((k) => k.unadjustedOffset);
const firstFocal = (list: KeylineList) => list.find((k) => k.isFocal)!;
const lastFocal = (list: KeylineList) => list.findLast((k) => k.isFocal)!;
const nonAnchors = (list: KeylineList) => list.filter((k) => !k.isAnchor);

const multiBrowse = (
  available: number,
  preferred: number,
  spacing: number,
  count: number,
  before = 0,
  after = 0
) =>
  createStrategy(
    arrangeMultiBrowse({
      available,
      preferred,
      spacing,
      count,
      minSmall: 40,
      maxSmall: 56,
    }),
    { available, spacing, before, after }
  );

const hero = (
  available: number,
  preferred: number | null,
  spacing: number,
  count: number,
  centered: boolean,
  before = 0,
  after = 0
) =>
  createStrategy(
    arrangeHero({
      available,
      preferred,
      spacing,
      count,
      centered,
      minSmall: 40,
      maxSmall: 56,
    }),
    { available, spacing, before, after }
  );

test.describe("multi-browse keylines (Compose's MultiBrowseTest)", () => {
  test("keeps the large size when there's room", () => {
    expect(multiBrowse(500, 120, 0, 10).itemSize).toBe(120);
  });

  test("shrinks a large item wider than the carousel to fit one small item", () => {
    const strategy = multiBrowse(100, 200, 0, 10);
    const keylines = strategy.defaultKeylines;
    expect(strategy.itemSize).toBeLessThanOrEqual(100);
    expect(keylines).toHaveLength(4);
    expect(keylines[0].unadjustedOffset).toBeLessThan(0);
    expect(keylines[3].unadjustedOffset).toBeGreaterThan(100);
    expect(keylines[1].isFocal).toBe(true);
    expect(keylines[2].size).toBe(40);
  });

  test("has no small items when there's no room for them", () => {
    const strategy = multiBrowse(40, 200, 0, 10);
    const keylines = nonAnchors(strategy.defaultKeylines);
    expect(strategy.itemSize).toBe(40);
    expect(keylines).toHaveLength(1);
    expect(keylines[0].isFocal).toBe(true);
  });

  test("has no keylines in no space", () => {
    expect(multiBrowse(0, 200, 0, 10).isValid).toBe(false);
    expect(multiBrowse(-10, 200, 0, 10).isValid).toBe(false);
  });

  test("makes the medium item between the large and small ones", () => {
    const keylines = multiBrowse(200 * 2 + 56 * 2, 200, 0, 10).defaultKeylines;
    expect(keylines).toHaveLength(6);
    expect(keylines[1].isFocal).toBe(true);
    expect(keylines[2].isFocal).toBe(true);
    expect(keylines[3].size).toBeLessThan(keylines[2].size);
    expect(keylines[4].size).toBeLessThan(keylines[3].size);
  });

  test("drops keylines beyond the item count", () => {
    const keylines = multiBrowse(200 * 2 + 56 * 2, 200, 0, 3).defaultKeylines;
    expect(keylines).toHaveLength(5);
    expect(keylines[1].isFocal).toBe(true);
    expect(keylines[2].isFocal).toBe(true);
    expect(keylines[3].size).toBeLessThan(keylines[2].size);
  });

  test("spaces items apart", () => {
    const strategy = multiBrowse(380, 186, 8, 10);
    const keylines = strategy.defaultKeylines;
    expect(firstFocal(keylines).size).toBe(186);
    expect(firstFocal(keylines).offset).toBe(186 / 2);
    const last = nonAnchors(keylines).at(-1)!;
    expect(last.offset + last.size / 2).toBe(380);
    expect(strategy.itemSize).toBe(186);
    expect(keylines[3].size).toBe(56);
    expect(keylines[3].offset).toBe(380 - 56 / 2);
    const max = 186 * 10 + 8 * 10 - 380;
    expect(unadjusted(keylinesForScroll(strategy, 0, max))).toEqual([
      -101, 93, 287, 481, 675,
    ]);
  });
});

test.describe("center-aligned hero keylines (Compose's CenteredHeroTest)", () => {
  test("fits one large item between two small ones", () => {
    expect(hero(100 + 40 + 40, null, 0, 6, true).itemSize).toBe(100);
  });

  test("is start-aligned with fewer than three items", () => {
    const strategy = hero(100 + 40 + 40, null, 0, 2, true);
    expect(strategy.itemSize).toBeGreaterThan(100);
    expect(strategy.defaultKeylines.findIndex((k) => k.isFocal)).toBe(1);
  });

  test("fills the carousel with one item only", () => {
    expect(hero(40 + 40 + 40, null, 0, 1, true).itemSize).toBe(120);
  });

  test("fills the carousel where two small items and a large one don't fit", () => {
    expect(hero(40 + 40 + 40, null, 0, 6, true).itemSize).toBe(120);
  });

  for (const [spacing, count] of [
    [0, 7],
    [12, 7],
    [12, 10],
  ])
    test(`puts the small items flush with the ends, ${spacing}px apart, ${count} items`, () => {
      const available = 300 + 300 + 300 + 40 + 40;
      const keylines = nonAnchors(
        hero(available, 300, spacing, count, true).defaultKeylines
      );
      expect(keylines[0].offset).toBeCloseTo(20, 3);
      expect(keylines.at(-1)!.offset).toBeCloseTo(available - 20, 3);
    });

  test("has no keylines in no space", () => {
    expect(hero(-10, 100, 0, 5, true).isValid).toBe(false);
    expect(hero(0, 100, 0, 5, true).isValid).toBe(false);
  });
});

test.describe("hero keylines", () => {
  // M3's Guidelines: "A hero carousel at a compact breakpoint should show one large item and one
  // small item"
  test("shows one large item and one small one at the end", () => {
    const keylines = nonAnchors(hero(412, null, 8, 6, false).defaultKeylines);
    expect(sizes(keylines)).toHaveLength(2);
    expect(keylines[0].isFocal).toBe(true);
    expect(keylines[1].size).toBeGreaterThanOrEqual(40);
    expect(keylines[1].size).toBeLessThanOrEqual(56);
    expect(keylines[0].size + 8 + keylines[1].size).toBeCloseTo(412, 3);
    expect(keylines[1].offset + keylines[1].size / 2).toBeCloseTo(412, 3);
  });

  // M3's Specs: center-aligned hero "shows at least one large item and two small items"
  test("centers one large item between two small ones", () => {
    const keylines = nonAnchors(hero(412, null, 8, 6, true).defaultKeylines);
    expect(keylines).toHaveLength(3);
    expect(keylines[1].isFocal).toBe(true);
    expect(keylines[1].offset).toBeCloseTo(412 / 2, 3);
    expect(keylines[0].size).toBe(keylines[2].size);
    expect(keylines[0].size).toBeLessThanOrEqual(56);
  });

  // M3's Guidelines: "On larger screens, more large items are visible"
  test("fits more large items near a preferred width", () => {
    const keylines = nonAnchors(hero(1000, 300, 8, 10, false).defaultKeylines);
    expect(keylines.filter((k) => k.isFocal).length).toBeGreaterThan(1);
  });
});

// Compose's StrategyTest sizes
const large = 100;
const small = 20;
const medium = (large + small) / 2;
const xSmall = 5;

const startAligned = () =>
  keylineListOf(large + medium + small, 0, "start", [
    [xSmall, true],
    [large],
    [medium],
    [small],
    [xSmall, true],
  ]);

test.describe("strategy (Compose's StrategyTest)", () => {
  test("shifts a start-aligned list at the end", () => {
    const available = large + medium + small;
    const max = 10 * large - available;
    const strategy = createStrategy(startAligned(), {
      available,
      spacing: 0,
      before: 0,
      after: 0,
    });
    expect(keylinesForScroll(strategy, 0, max)).toEqual(startAligned());
    const end = keylinesForScroll(strategy, max, max);
    expect(offsets(end)).toEqual([-2.5, 10, 50, 130, 182.5]);
    expect(unadjusted(end)).toEqual([
      130 - 300,
      130 - 200,
      130 - 100,
      130,
      130 + 100,
    ]);
  });

  test("keeps a start-aligned list when it can't scroll", () => {
    const available = large + medium + small;
    const strategy = createStrategy(startAligned(), {
      available,
      spacing: 0,
      before: 0,
      after: 0,
    });
    expect(keylinesForScroll(strategy, 0, large - available)).toEqual(
      startAligned()
    );
  });

  test("pads the start and end, even when the shifts overlap", () => {
    const available = large + small;
    const max = large * 2 - available;
    const strategy = createStrategy(
      keylineListOf(available, 0, "start", [
        [xSmall, true],
        [large],
        [small],
        [xSmall, true],
      ]),
      { available, spacing: 0, before: 24, after: 48 }
    );
    const start = keylinesForScroll(strategy, 0, max);
    expect(firstFocal(start).offset).toBe(24 + firstFocal(start).size / 2);
    const end = keylinesForScroll(strategy, max, max);
    expect(lastFocal(end).offset).toBe(
      available - 48 - lastFocal(end).size / 2
    );
  });

  test("accounts for item spacing in the end steps", () => {
    const strategy = createStrategy(
      keylineListOf(380, 8, "start", [
        [10, true],
        [186],
        [122],
        [56],
        [10, true],
      ]),
      { available: 380, spacing: 8, before: 0, after: 0 }
    );
    expect(offsets(strategy.endSteps[1])).toEqual([-13, 28, 157, 319, 393]);
    expect(unadjusted(strategy.endSteps[1])).toEqual([
      -231, -37, 157, 351, 545,
    ]);
    expect(offsets(strategy.endSteps[2])).toEqual([-13, 28, 125, 287, 393]);
    // the last step ends with the large item, at the carousel's end
    expect(sizes(strategy.endSteps[2]).slice(1, -1)).toEqual([56, 122, 186]);
  });
});

test.describe("snap positions (Compose's KeylineSnapPositionTest)", () => {
  const strategyOf = (list: KeylineList) =>
    createStrategy(list, { available: 1000, spacing: 0, before: 0, after: 0 });

  test("start-aligned", () => {
    const strategy = strategyOf(
      keylineListOf(1000, 0, "start", [
        [5, true],
        [400],
        [200],
        [200],
        [100],
        [100],
        [5, true],
      ])
    );
    expect([0, 1, 2, 3, 4, 5].map((i) => snapOffset(strategy, i, 6))).toEqual([
      0, 0, 100, 200, 400, 600,
    ]);
  });

  const multipleFocal = () =>
    strategyOf(
      keylineListOf(1000, 0, "start", [
        [5, true],
        [400],
        [400],
        [125],
        [75],
        [5, true],
      ])
    );

  test("start-aligned with two large items", () => {
    expect(
      [0, 1, 2, 3, 4].map((i) => snapOffset(multipleFocal(), i, 5))
    ).toEqual([0, 0, 400, 75 + 400, 75 + 125 + 400]);
  });

  test("center-aligned with one large item", () => {
    const strategy = strategyOf(
      keylineListOf(1000, 0, "center", [
        [5, true],
        [100],
        [200],
        [400],
        [200],
        [100],
        [5, true],
      ])
    );
    expect([0, 1, 2, 3, 4, 5].map((i) => snapOffset(strategy, i, 6))).toEqual([
      0, 200, 300, 300, 400, 600,
    ]);
  });

  test("center-aligned with two large items", () => {
    const available = 10 + 40 + 100 + 100 + 40 + 10;
    const strategy = createStrategy(
      keylineListOf(available, 0, "center", [
        [5, true],
        [10],
        [40],
        [100],
        [100],
        [40],
        [10],
        [5, true],
      ]),
      { available, spacing: 0, before: 0, after: 0 }
    );
    expect(
      Array.from({ length: 10 }, (_, i) => snapOffset(strategy, i, 10))
    ).toEqual([
      0,
      40,
      50,
      50,
      50,
      50,
      50,
      10 + 40 + 100,
      10 + 10 + 40 + 100,
      10 + 10 + 40 + 40 + 100,
    ]);
  });

  test("start-aligned with fewer items than keylines", () => {
    expect([0, 1, 2, 3].map((i) => snapOffset(multipleFocal(), i, 4))).toEqual([
      0,
      400,
      75 + 400,
      75 + 125 + 400,
    ]);
    expect(snapOffset(multipleFocal(), 0, 1)).toBe(0);
  });
});

test.describe("item placement (Compose's Modifier.carouselItem)", () => {
  // 380px wide, 186px preferred, 8px apart, 10 items: large, medium and small at rest
  const strategy = multiBrowse(380, 186, 8, 10, 16, 16);
  const size = (i: number, scroll: number) =>
    itemPlacement(strategy, i, scroll, 10).size;

  test("sizes the items large, medium and small at the start", () => {
    const [a, b, c] = [0, 1, 2].map((i) => size(i, 0));
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThanOrEqual(40);
    expect(c).toBeLessThanOrEqual(56);
  });

  test("starts the first item after the start padding", () => {
    const { size: width, translation } = itemPlacement(strategy, 0, 0, 10);
    const start = (strategy.itemSize - width) / 2 + translation;
    expect(start).toBeCloseTo(16, 3);
  });

  test("ends the last item before the end padding when scrolled to the end", () => {
    const max = 10 * strategy.itemSize + 9 * 8 - 380;
    const { size: width, translation } = itemPlacement(strategy, 9, max, 10);
    const slotStart = 9 * (strategy.itemSize + 8) - max;
    const end = slotStart + (strategy.itemSize + width) / 2 + translation;
    expect(end).toBeCloseTo(380 - 16, 3);
    // the padding comes out of the large and medium items' sizes, 8px each
    expect(width).toBeCloseTo(strategy.itemSize - 16 / 2, 3);
  });

  // M3's Specs: small items are 40 to 56dp. Compose takes the padding out of every item, the
  // small one too, which takes it under 40dp at the ends; the Specs' range wins.
  test("keeps the small item 40 to 56px at the ends, padding and all", () => {
    const tight = multiBrowse(412, 186, 8, 8, 16, 16);
    const max = 8 * tight.itemSize + 7 * 8 - 412;
    const smallAt = (i: number, scroll: number) =>
      itemPlacement(tight, i, scroll, 8).size;
    expect(smallAt(2, 0)).toBeGreaterThanOrEqual(40);
    expect(smallAt(2, 0)).toBeLessThanOrEqual(56);
    expect(smallAt(5, max)).toBeGreaterThanOrEqual(40);
    expect(smallAt(5, max)).toBeLessThanOrEqual(56);
  });

  // A medium or small item brought into view goes to the nearest place it's large: from the
  // start, to the large place at the row's start; from the end, back to it
  test("scrolls a medium or small item the least way to a place it's large", () => {
    const row = multiBrowse(412, 186, 8, 8, 16, 16);
    const step = row.itemSize + 8;
    const max = 8 * row.itemSize + 7 * 8 - 412;
    expect(scrollToShow(row, 1, 8, 0)).toBeCloseTo(step, 3);
    expect(scrollToShow(row, 2, 8, 0)).toBeCloseTo(2 * step, 3);
    expect(scrollToShow(row, 3, 8, step)).toBeCloseTo(3 * step, 3);
    expect(itemPlacement(row, 2, 2 * step, 8).size).toBeCloseTo(
      row.itemSize,
      3
    );
    expect(scrollToShow(row, 5, 8, max)).toBeCloseTo(5 * step, 3);
    expect(scrollToShow(row, 6, 8, max)).toBeLessThan(max);
    // a large item stays where it is, at the ends too, where the padding shrinks it
    expect(scrollToShow(row, 0, 8, 0)).toBe(0);
    expect(scrollToShow(row, 7, 8, max)).toBe(max);
  });

  // M3's Specs: multi-browse "shows at least one large, medium, and small carousel item".
  // Compose would arrange two large items and a small one here.
  test("keeps a medium item where Compose would drop it", () => {
    const sizes = nonAnchors(multiBrowse(412, 186, 8, 8).defaultKeylines).map(
      (k) => k.size
    );
    expect(sizes).toHaveLength(3);
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
    expect(sizes[2]).toBeLessThanOrEqual(56);
  });

  test("grows an item to large as it scrolls to its snap position", () => {
    const at = (i: number) =>
      i * (strategy.itemSize + 8) - snapOffset(strategy, i, 10);
    expect(size(3, at(3))).toBeCloseTo(strategy.itemSize, 3);
    expect(size(3, at(2))).toBeLessThan(strategy.itemSize);
  });
});

test.describe("hero item placement", () => {
  const placed = (
    strategy: ReturnType<typeof hero>,
    i: number,
    scroll: number,
    count: number
  ) => {
    const { size, translation } = itemPlacement(strategy, i, scroll, count);
    const start =
      i * (strategy.itemSize + 8) -
      scroll +
      (strategy.itemSize - size) / 2 +
      translation;
    return { size, start, end: start + size };
  };

  // The small item reaches the carousel's end, as multi-browse's does: the padding shows at the
  // start, and at the end once the row is scrolled there
  test("starts with the large item after the padding and a small one at the end", () => {
    const row = hero(412, null, 8, 6, false, 16, 16);
    const first = placed(row, 0, 0, 6);
    const second = placed(row, 1, 0, 6);
    expect(first.start).toBeCloseTo(16, 3);
    expect(second.size).toBeGreaterThanOrEqual(40);
    expect(second.size).toBeLessThanOrEqual(56);
    expect(second.end).toBeCloseTo(412, 3);
  });

  test("centers the large item between two small ones away from the ends", () => {
    const row = hero(412, null, 8, 6, true, 16, 16);
    const at = (i: number) => i * (row.itemSize + 8) - snapOffset(row, i, 6);
    const centered = placed(row, 2, at(2), 6);
    expect(centered.size).toBeCloseTo(row.itemSize, 3);
    expect((centered.start + centered.end) / 2).toBeCloseTo(412 / 2, 3);
    for (const i of [1, 3]) {
      const side = placed(row, i, at(2), 6);
      expect(side.size).toBeGreaterThanOrEqual(40);
      expect(side.size).toBeLessThanOrEqual(56);
    }
  });

  test("puts the first item large at the start and the last at the end", () => {
    const row = hero(412, null, 8, 6, true, 16, 16);
    const max = 6 * row.itemSize + 5 * 8 - 412;
    const sizesAt = (scroll: number) =>
      [0, 1, 2, 3, 4, 5].map((i) => placed(row, i, scroll, 6).size);
    expect(placed(row, 0, 0, 6).start).toBeCloseTo(16, 3);
    expect(Math.max(...sizesAt(0))).toBe(sizesAt(0)[0]);
    expect(placed(row, 5, max, 6).end).toBeCloseTo(412 - 16, 3);
    expect(Math.max(...sizesAt(max))).toBe(sizesAt(max)[5]);
  });

  test("scrolls a small item to its place as the large one, one item on", () => {
    const row = hero(412, null, 8, 6, true, 16, 16);
    const at = (i: number) => i * (row.itemSize + 8) - snapOffset(row, i, 6);
    expect(scrollToShow(row, 3, 6, at(2))).toBeCloseTo(at(3), 3);
    expect(scrollToShow(row, 1, 6, at(2))).toBeCloseTo(at(1), 3);
  });
});
