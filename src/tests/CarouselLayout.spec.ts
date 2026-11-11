import { test, expect } from "@playwright/test";
import {
  arrangeMultiBrowse,
  createStrategy,
  itemPlacement,
  keylineListOf,
  keylinesForScroll,
  snapOffset,
  type KeylineList,
} from "../carousel";

// The carousel's layout math, ported from Compose's (androidx.compose.material3.carousel), checked
// against the cases in Compose's own unit tests: MultiBrowseTest, StrategyTest and
// KeylineSnapPositionTest. It's pure, so it runs once, outside a browser.
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
    // the padding comes out of the three visible items' sizes, as Compose's does
    expect(width).toBeCloseTo(strategy.itemSize - 16 / 3, 3);
  });

  test("grows an item to large as it scrolls to its snap position", () => {
    const at = (i: number) =>
      i * (strategy.itemSize + 8) - snapOffset(strategy, i, 10);
    expect(size(3, at(3))).toBeCloseTo(strategy.itemSize, 3);
    expect(size(3, at(2))).toBeLessThan(strategy.itemSize);
  });
});
