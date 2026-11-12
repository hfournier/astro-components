/**
 * The carousel's layout, ported from Compose's (androidx.compose.material3.carousel: Arrangement,
 * Keylines, KeylineList, Strategy, KeylineSnapPosition and Carousel's Modifier.carouselItem),
 * which M3's Specs and Guidelines describe but don't give as numbers.
 *
 * A keyline is a place in the carousel where an item has a set size: the large items first, then
 * a medium and a small one, with a tiny anchor just past each end. Every item is laid out at the
 * large size, one after another, and scrolls natively; as it scrolls, its center moves between
 * two keylines, and it takes the size and place between theirs. Near the ends, the keylines shift,
 * step by step, so the first and last items can become large too and the content padding shows.
 *
 * It's pure, so the spec checks it against Compose's own unit tests (CarouselLayout.spec.ts).
 */

export type Keyline = {
  size: number;
  /** Where its center is in the carousel */
  offset: number;
  /** Where its center would be if every item were the large size */
  unadjustedOffset: number;
  isFocal: boolean;
  isAnchor: boolean;
  isPivot: boolean;
  /** How much of it is past the carousel's start or end */
  cutoff: number;
};

export type KeylineList = Keyline[];

/** A keyline's size, and whether it's an anchor, before it's placed */
export type KeylineEntry = [size: number, isAnchor?: boolean];

// Compose's CarouselDefaults
export const ANCHOR_SIZE = 10;
const MEDIUM_ITEM_FLEX = 0.1;

const lerp = (from: number, to: number, fraction: number) =>
  from + (to - from) * fraction;
// Compose's lerp(outputMin, outputMax, inputMin, inputMax, value), clamped
const lerpClamped = (
  outputMin: number,
  outputMax: number,
  inputMin: number,
  inputMax: number,
  value: number
) => {
  if (value <= inputMin) return outputMin;
  if (value >= inputMax) return outputMax;
  return lerp(outputMin, outputMax, (value - inputMin) / (inputMax - inputMin));
};
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const firstFocalIndex = (list: KeylineList) => list.findIndex((k) => k.isFocal);
const lastFocalIndex = (list: KeylineList) =>
  list.findLastIndex((k) => k.isFocal);
const firstNonAnchorIndex = (list: KeylineList) =>
  list.findIndex((k) => !k.isAnchor);
const lastNonAnchorIndex = (list: KeylineList) =>
  list.findLastIndex((k) => !k.isAnchor);
const pivotIndexOf = (list: KeylineList) => list.findIndex((k) => k.isPivot);

// --- Arrangement: how many large, medium and small items fit, and their sizes ---

type Arrangement = {
  priority: number;
  smallSize: number;
  smallCount: number;
  mediumSize: number;
  mediumCount: number;
  largeSize: number;
  largeCount: number;
};

const arrangementCost = (a: Arrangement, targetLargeSize: number) => {
  const valid =
    a.largeCount > 0 && a.smallCount > 0 && a.mediumCount > 0
      ? a.largeSize > a.mediumSize && a.mediumSize > a.smallSize
      : a.largeCount > 0 && a.smallCount > 0
        ? a.largeSize > a.smallSize
        : true;
  return valid
    ? Math.abs(targetLargeSize - a.largeSize) * a.priority
    : Infinity;
};

const fit = (
  priority: number,
  available: number,
  spacing: number,
  smallCount: number,
  smallSize: number,
  minSmall: number,
  maxSmall: number,
  mediumCount: number,
  mediumSize: number,
  largeCount: number,
  largeSize: number
): Arrangement => {
  const total = largeCount + mediumCount + smallCount;
  const space = available - (total - 1) * spacing;
  let small = clamp(smallSize, minSmall, maxSmall);
  const taken =
    largeSize * largeCount + mediumSize * mediumCount + small * smallCount;
  const delta = space - taken;
  if (smallCount > 0 && delta > 0)
    small += Math.min(delta / smallCount, maxSmall - small);
  else if (smallCount > 0 && delta < 0)
    small += Math.max(delta / smallCount, minSmall - small);
  small = smallCount > 0 ? small : 0;
  let large =
    (space - (smallCount + mediumCount / 2) * small) /
    (largeCount + mediumCount / 2);
  let medium = (large + small) / 2;
  if (mediumCount > 0 && large !== largeSize) {
    const targetAdjustment = (largeSize - large) * largeCount;
    const flex = medium * MEDIUM_ITEM_FLEX * mediumCount;
    const distribute = Math.min(Math.abs(targetAdjustment), flex);
    if (targetAdjustment > 0) {
      medium -= distribute / mediumCount;
      large += distribute / largeCount;
    } else {
      medium += distribute / mediumCount;
      large -= distribute / largeCount;
    }
  }
  return {
    priority,
    smallSize: small,
    smallCount,
    mediumSize: medium,
    mediumCount,
    largeSize: large,
    largeCount,
  };
};

const findLowestCostArrangement = (
  available: number,
  spacing: number,
  targetSmall: number,
  minSmall: number,
  maxSmall: number,
  smallCounts: number[],
  targetMedium: number,
  mediumCounts: number[],
  targetLarge: number,
  largeCounts: number[]
) => {
  let lowest: Arrangement | null = null;
  let priority = 1;
  for (const largeCount of largeCounts)
    for (const mediumCount of mediumCounts)
      for (const smallCount of smallCounts) {
        const arrangement = fit(
          priority,
          available,
          spacing,
          smallCount,
          targetSmall,
          minSmall,
          maxSmall,
          mediumCount,
          targetMedium,
          largeCount,
          targetLarge
        );
        if (
          !lowest ||
          arrangementCost(arrangement, targetLarge) <
            arrangementCost(lowest, targetLarge)
        ) {
          lowest = arrangement;
          if (arrangementCost(lowest, targetLarge) === 0) return lowest;
        }
        priority++;
      }
  return lowest;
};

// --- Keyline lists ---

const isCutoffLeft = (size: number, offset: number) =>
  offset - size / 2 < 0 && offset + size / 2 > 0;
const isCutoffRight = (size: number, offset: number, available: number) =>
  offset - size / 2 < available && offset + size / 2 > available;

const focalRange = (entries: KeylineEntry[]) => {
  let first = -1;
  let focalSize = 0;
  entries.forEach(([size, isAnchor], i) => {
    if (!isAnchor && size > focalSize) {
      first = i;
      focalSize = size;
    }
  });
  let last = first;
  while (
    first >= 0 &&
    last < entries.length - 1 &&
    entries[last + 1][0] === focalSize
  )
    last++;
  return { first, last, focalSize };
};

/**
 * Places keylines around a pivot: the pivot's center at `pivotOffset`, the others before and
 * after it, each `spacing` apart. Their unadjusted offsets are every item at the focal size.
 */
export const keylineListWithPivot = (
  available: number,
  spacing: number,
  pivotIndex: number,
  pivotOffset: number,
  entries: KeylineEntry[]
): KeylineList => {
  const { first, last, focalSize } = focalRange(entries);
  if (!entries.length || pivotIndex < 0 || pivotIndex >= entries.length)
    return [];
  const isFocal = (i: number) => i >= first && i <= last;
  const [pivotSize, pivotIsAnchor = false] = entries[pivotIndex];
  const keylines: KeylineList = [
    {
      size: pivotSize,
      offset: pivotOffset,
      unadjustedOffset: pivotOffset,
      isFocal: isFocal(pivotIndex),
      isAnchor: pivotIsAnchor,
      isPivot: true,
      cutoff: isCutoffLeft(pivotSize, pivotOffset)
        ? pivotOffset - pivotSize / 2
        : isCutoffRight(pivotSize, pivotOffset, available)
          ? pivotOffset + pivotSize / 2 - available
          : 0,
    },
  ];
  let offset = pivotOffset - focalSize / 2 - spacing;
  let unadjustedOffset = pivotOffset - focalSize / 2 - spacing;
  for (let i = pivotIndex - 1; i >= 0; i--) {
    const [size, isAnchor = false] = entries[i];
    const center = offset - size / 2;
    keylines.unshift({
      size,
      offset: center,
      unadjustedOffset: unadjustedOffset - focalSize / 2,
      isFocal: isFocal(i),
      isAnchor,
      isPivot: false,
      cutoff: isCutoffLeft(size, center) ? Math.abs(center - size / 2) : 0,
    });
    offset -= size + spacing;
    unadjustedOffset -= focalSize + spacing;
  }
  offset = pivotOffset + focalSize / 2 + spacing;
  unadjustedOffset = pivotOffset + focalSize / 2 + spacing;
  for (let i = pivotIndex + 1; i < entries.length; i++) {
    const [size, isAnchor = false] = entries[i];
    const center = offset + size / 2;
    keylines.push({
      size,
      offset: center,
      unadjustedOffset: unadjustedOffset + focalSize / 2,
      isFocal: isFocal(i),
      isAnchor,
      isPivot: false,
      cutoff: isCutoffRight(size, center, available)
        ? center + size / 2 - available
        : 0,
    });
    offset += size + spacing;
    unadjustedOffset += focalSize + spacing;
  }
  return keylines;
};

/** Places keylines with the focal ones at the carousel's start, center or end */
export const keylineListOf = (
  available: number,
  spacing: number,
  alignment: "start" | "center" | "end",
  entries: KeylineEntry[]
): KeylineList => {
  const { first, last, focalSize } = focalRange(entries);
  const focalCount = last - first;
  let pivotOffset = focalSize / 2;
  if (alignment === "center") {
    const split = spacing === 0 || focalCount % 2 === 0 ? 0 : spacing / 2;
    pivotOffset =
      available / 2 -
      (focalSize / 2) * focalCount -
      split -
      Math.trunc(focalCount / 2) * spacing;
  } else if (alignment === "end") pivotOffset = available - focalSize / 2;
  return keylineListWithPivot(available, spacing, first, pivotOffset, entries);
};

const entriesOf = (list: KeylineList): KeylineEntry[] =>
  list.map((k) => [k.size, k.isAnchor]);

/**
 * Multi-browse: as many large items as fit at the preferred size, a medium and a small one,
 * start-aligned (Compose's multiBrowseKeylineList).
 */
export const arrangeMultiBrowse = ({
  available,
  preferred,
  spacing,
  count,
  minSmall,
  maxSmall,
}: {
  available: number;
  preferred: number;
  spacing: number;
  count: number;
  minSmall: number;
  maxSmall: number;
}): KeylineList => {
  if (available <= 0 || preferred <= 0) return [];
  let smallCounts = [1];
  const mediumCounts = [1, 0];
  const targetLarge = Math.min(preferred, available);
  const targetSmall = clamp(targetLarge / 3, minSmall, maxSmall);
  const targetMedium = (targetLarge + targetSmall) / 2;
  if (available < minSmall * 2) smallCounts = [0];
  const minAvailableLarge =
    available -
    targetMedium * Math.max(...mediumCounts) -
    maxSmall * Math.max(...smallCounts);
  const minLargeCount = Math.max(
    1,
    Math.floor(minAvailableLarge / targetLarge)
  );
  const maxLargeCount = Math.ceil(available / targetLarge);
  const largeCounts = Array.from(
    { length: maxLargeCount - minLargeCount + 1 },
    (_, i) => maxLargeCount - i
  );
  const arrange = (smalls: number[], mediums: number[]) =>
    findLowestCostArrangement(
      available,
      spacing,
      targetSmall,
      minSmall,
      maxSmall,
      smalls,
      targetMedium,
      mediums,
      targetLarge,
      largeCounts
    );
  let arrangement = arrange(smallCounts, mediumCounts);
  if (arrangement) {
    const total =
      arrangement.largeCount + arrangement.mediumCount + arrangement.smallCount;
    if (total > count) {
      let surplus = total - count;
      let { smallCount, mediumCount } = arrangement;
      while (surplus > 0) {
        if (smallCount > 0) smallCount--;
        else if (mediumCount > 1) mediumCount--;
        surplus--;
      }
      arrangement = arrange([smallCount], [mediumCount]);
    }
  }
  if (!arrangement) return [];
  const {
    largeCount,
    largeSize,
    mediumCount,
    mediumSize,
    smallCount,
    smallSize,
  } = arrangement;
  return keylineListOf(available, spacing, "start", [
    [ANCHOR_SIZE, true],
    ...Array<KeylineEntry>(largeCount).fill([largeSize]),
    ...Array<KeylineEntry>(mediumCount).fill([mediumSize]),
    ...Array<KeylineEntry>(smallCount).fill([smallSize]),
    [ANCHOR_SIZE, true],
  ]);
};

// --- Strategy: the keylines at each scroll position ---

export type Strategy = {
  defaultKeylines: KeylineList;
  startSteps: KeylineList[];
  endSteps: KeylineList[];
  available: number;
  spacing: number;
  /** The size every item is laid out at: the focal (large) size */
  itemSize: number;
  isValid: boolean;
  startShiftDistance: number;
  endShiftDistance: number;
  startShiftPoints: number[];
  endShiftPoints: number[];
};

const firstIndexAfterFocalWithSize = (list: KeylineList, size: number) => {
  for (let i = lastFocalIndex(list); i < list.length; i++)
    if (list[i].size === size) return i;
  return list.length - 1;
};
const lastIndexBeforeFocalWithSize = (list: KeylineList, size: number) => {
  for (let i = firstFocalIndex(list) - 1; i >= 0; i--)
    if (list[i].size === size) return i;
  return 0;
};

const moveKeyline = (
  from: KeylineList,
  srcIndex: number,
  dstIndex: number,
  available: number,
  spacing: number
) => {
  const direction = srcIndex > dstIndex ? 1 : -1;
  const delta =
    (from[srcIndex].size - from[srcIndex].cutoff + spacing) * direction;
  const pivot = pivotIndexOf(from);
  const entries = entriesOf(from);
  const [moved] = entries.splice(srcIndex, 1);
  entries.splice(dstIndex, 0, moved);
  return keylineListWithPivot(
    available,
    spacing,
    pivot + direction,
    from[pivot].offset + delta,
    entries
  );
};

const shiftForContentPadding = (
  from: KeylineList,
  available: number,
  spacing: number,
  padding: number,
  pivot: Keyline,
  pivotIndex: number
) => {
  // Compose takes the padding out of every keyline. M3's Specs keep small items 40 to 56dp, so
  // here it comes out of the items larger than the smallest only (all of them when they're one
  // size), and the anchors, off screen, keep theirs.
  const items = from.filter((k) => !k.isAnchor);
  const smallest = Math.min(...items.map((k) => k.size));
  const shrinks = (k: Keyline) =>
    !k.isAnchor &&
    (k.size > smallest || items.every((item) => item.size === smallest));
  const reduction = padding / from.filter(shrinks).length;
  const shifted = keylineListWithPivot(
    available,
    spacing,
    pivotIndex,
    pivot.offset - reduction / 2 + padding,
    from.map((k) => [
      shrinks(k) ? k.size - Math.abs(reduction) : k.size,
      k.isAnchor,
    ])
  );
  return shifted.map((k, i) => ({
    ...k,
    unadjustedOffset: from[i].unadjustedOffset,
  }));
};

const isFirstFocalAtStart = (list: KeylineList) => {
  const focal = list[firstFocalIndex(list)];
  return (
    focal.offset - focal.size / 2 >= 0 &&
    firstFocalIndex(list) === firstNonAnchorIndex(list)
  );
};
const isLastFocalAtEnd = (list: KeylineList, available: number) => {
  const focal = list[lastFocalIndex(list)];
  return (
    focal.offset + focal.size / 2 <= available &&
    lastFocalIndex(list) === lastNonAnchorIndex(list)
  );
};

const startStepsOf = (
  keylines: KeylineList,
  available: number,
  spacing: number,
  before: number
) => {
  if (!keylines.length) return [];
  const steps = [keylines];
  const pad = (list: KeylineList) =>
    shiftForContentPadding(
      list,
      available,
      spacing,
      before,
      list[firstFocalIndex(list)],
      firstFocalIndex(list)
    );
  if (isFirstFocalAtStart(keylines)) {
    if (before !== 0) steps.push(pad(keylines));
    return steps;
  }
  const startIndex = firstNonAnchorIndex(keylines);
  const numberOfSteps = firstFocalIndex(keylines) - startIndex;
  if (numberOfSteps <= 0 && keylines[firstFocalIndex(keylines)].cutoff > 0) {
    steps.push(moveKeyline(keylines, 0, 0, available, spacing));
    return steps;
  }
  for (let i = 0; i < numberOfSteps; i++) {
    const prev = steps.at(-1)!;
    const original = startIndex + i;
    let dstIndex = keylines.length - 1;
    if (original > 0)
      dstIndex =
        firstIndexAfterFocalWithSize(prev, keylines[original - 1].size) - 1;
    steps.push(
      moveKeyline(
        prev,
        firstNonAnchorIndex(keylines),
        dstIndex,
        available,
        spacing
      )
    );
  }
  if (before !== 0) steps[steps.length - 1] = pad(steps.at(-1)!);
  return steps;
};

const endStepsOf = (
  keylines: KeylineList,
  available: number,
  spacing: number,
  after: number
) => {
  if (!keylines.length) return [];
  const steps = [keylines];
  const pad = (list: KeylineList) =>
    shiftForContentPadding(
      list,
      available,
      spacing,
      -after,
      list[lastFocalIndex(list)],
      lastFocalIndex(list)
    );
  if (isLastFocalAtEnd(keylines, available)) {
    if (after !== 0) steps.push(pad(keylines));
    return steps;
  }
  const startIndex = lastFocalIndex(keylines);
  const endIndex = lastNonAnchorIndex(keylines);
  const numberOfSteps = endIndex - startIndex;
  if (numberOfSteps <= 0 && keylines[lastFocalIndex(keylines)].cutoff > 0) {
    steps.push(moveKeyline(keylines, 0, 0, available, spacing));
    return steps;
  }
  for (let i = 0; i < numberOfSteps; i++) {
    const prev = steps.at(-1)!;
    const original = endIndex - i;
    let dstIndex = 0;
    if (original < keylines.length - 1)
      dstIndex =
        lastIndexBeforeFocalWithSize(prev, keylines[original + 1].size) + 1;
    steps.push(
      moveKeyline(
        prev,
        lastNonAnchorIndex(keylines),
        dstIndex,
        available,
        spacing
      )
    );
  }
  if (after !== 0) steps[steps.length - 1] = pad(steps.at(-1)!);
  return steps;
};

const shiftPointsOf = (
  distance: number,
  steps: KeylineList[],
  isShiftingLeft: boolean
) => {
  const points = [0];
  if (distance === 0 || !steps.length) return points;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const curr = steps[i];
    const shifted = isShiftingLeft
      ? curr[0].unadjustedOffset - prev[0].unadjustedOffset
      : prev.at(-1)!.unadjustedOffset - curr.at(-1)!.unadjustedOffset;
    points.push(
      i === steps.length - 1 ? 1 : points[i - 1] + shifted / distance
    );
  }
  return points;
};

/** The keylines and their shifted steps near each end, for a carousel's size and padding */
export const createStrategy = (
  defaultKeylines: KeylineList,
  {
    available,
    spacing,
    before,
    after,
  }: { available: number; spacing: number; before: number; after: number }
): Strategy => {
  const startSteps = startStepsOf(defaultKeylines, available, spacing, before);
  const endSteps = endStepsOf(defaultKeylines, available, spacing, after);
  const startShiftDistance = startSteps.length
    ? Math.max(
        startSteps.at(-1)![0].unadjustedOffset -
          startSteps[0][0].unadjustedOffset,
        before
      )
    : 0;
  const endShiftDistance = endSteps.length
    ? Math.max(
        endSteps[0].at(-1)!.unadjustedOffset -
          endSteps.at(-1)!.at(-1)!.unadjustedOffset,
        after
      )
    : 0;
  const itemSize = defaultKeylines.length
    ? defaultKeylines[firstFocalIndex(defaultKeylines)].size
    : 0;
  return {
    defaultKeylines,
    startSteps,
    endSteps,
    available,
    spacing,
    itemSize,
    isValid: defaultKeylines.length > 0 && available !== 0 && itemSize !== 0,
    startShiftDistance,
    endShiftDistance,
    startShiftPoints: shiftPointsOf(startShiftDistance, startSteps, true),
    endShiftPoints: shiftPointsOf(endShiftDistance, endSteps, false),
  };
};

const lerpKeyline = (a: Keyline, b: Keyline, f: number): Keyline => ({
  size: lerp(a.size, b.size, f),
  offset: lerp(a.offset, b.offset, f),
  unadjustedOffset: lerp(a.unadjustedOffset, b.unadjustedOffset, f),
  isFocal: f < 0.5 ? a.isFocal : b.isFocal,
  isAnchor: f < 0.5 ? a.isAnchor : b.isAnchor,
  isPivot: f < 0.5 ? a.isPivot : b.isPivot,
  cutoff: lerp(a.cutoff, b.cutoff, f),
});

/** The keylines at a scroll position: the default ones, or between two steps near an end */
export const keylinesForScroll = (
  strategy: Strategy,
  scroll: number,
  maxScroll: number
): KeylineList => {
  const position = Math.max(0, scroll);
  const startShiftOffset = strategy.startShiftDistance;
  const endShiftOffset = Math.max(0, maxScroll - strategy.endShiftDistance);
  if (position >= startShiftOffset && position <= endShiftOffset)
    return strategy.defaultKeylines;
  let interpolation = lerpClamped(1, 0, 0, startShiftOffset, position);
  let points = strategy.startShiftPoints;
  let steps = strategy.startSteps;
  if (position > endShiftOffset) {
    interpolation = lerpClamped(0, 1, endShiftOffset, maxScroll, position);
    points = strategy.endShiftPoints;
    steps = strategy.endSteps;
    if (
      endShiftOffset < 0.01 &&
      strategy.startSteps.length === 2 &&
      strategy.endSteps.length === 2
    )
      steps = [strategy.startSteps.at(-1)!, strategy.endSteps.at(-1)!];
  }
  let from = 0;
  let to = 0;
  let stepped = 0;
  let lower = points[0];
  for (let i = 1; i < steps.length; i++) {
    const upper = points[i];
    if (interpolation <= upper) {
      from = i - 1;
      to = i;
      stepped = lerpClamped(0, 1, lower, upper, interpolation);
      break;
    }
    lower = upper;
  }
  return steps[from].map((k, i) => lerpKeyline(k, steps[to][i], stepped));
};

/**
 * Where item `index` starts in the carousel when it's snapped, from the carousel's start: the
 * first focal keyline's start, shifted near the ends (Compose's getSnapPositionOffset).
 */
export const snapOffset = (
  strategy: Strategy,
  index: number,
  count: number
) => {
  if (!strategy.isValid) return 0;
  const half = strategy.itemSize / 2;
  const focalStart = (list: KeylineList) =>
    Math.round(list[firstFocalIndex(list)].unadjustedOffset - half);
  const focalEnd = (list: KeylineList) =>
    Math.round(list[lastFocalIndex(list)].unadjustedOffset - half);
  let offset = focalStart(strategy.defaultKeylines);
  const lastStart = strategy.startSteps.length - 1;
  if (index <= lastStart)
    offset = focalStart(
      strategy.startSteps[clamp(lastStart - index, 0, lastStart)]
    );
  const lastEnd = strategy.endSteps.length - 1;
  const focalCount =
    lastFocalIndex(strategy.defaultKeylines) -
    firstFocalIndex(strategy.defaultKeylines) +
    1;
  if (index >= count - 1 - lastEnd && count > focalCount)
    offset = focalEnd(
      strategy.endSteps[clamp(lastEnd - (count - 1 - index), 0, lastEnd)]
    );
  return offset;
};

/** How far the carousel scrolls: every item at the large size, less the carousel */
export const maxScrollOf = (strategy: Strategy, count: number) =>
  Math.max(
    0,
    strategy.itemSize * count +
      strategy.spacing * (count - 1) -
      strategy.available
  );

/**
 * An item's size at a scroll position, and how far it moves from where it's laid out, toward the
 * carousel's end (Compose's Modifier.carouselItem). Its visible part is that size, centered on its
 * laid-out box, moved by `translation`; its content stays at the large size, centered on the
 * same, which gives the parallax.
 */
export const itemPlacement = (
  strategy: Strategy,
  index: number,
  scroll: number,
  count: number
) => {
  const keylines = keylinesForScroll(
    strategy,
    scroll,
    maxScrollOf(strategy, count)
  );
  const center =
    index * (strategy.itemSize + strategy.spacing) +
    strategy.itemSize / 2 -
    scroll;
  const before =
    keylines.findLast((k) => k.unadjustedOffset < center) ?? keylines[0];
  const after =
    keylines.find((k) => k.unadjustedOffset >= center) ?? keylines.at(-1)!;
  const progress =
    before === after
      ? 1
      : (center - before.unadjustedOffset) /
        (after.unadjustedOffset - before.unadjustedOffset);
  const keyline = lerpKeyline(before, after, progress);
  let translation = keyline.offset - center;
  if (before === after)
    translation += (center - keyline.unadjustedOffset) / keyline.size;
  return { size: keyline.size, translation };
};

/** The scroll position where an item snaps: at its snap offset from the row's view's start */
export const snapScroll = (strategy: Strategy, index: number, count: number) =>
  index * (strategy.itemSize + strategy.spacing) -
  snapOffset(strategy, index, count);

/**
 * Where the row scrolls to show an item large: of the snap positions where it's large, the
 * nearest to `scroll`, so an item at the end of the row goes to the last large place, as one at
 * the start goes to the first. Where it's already large, `scroll` itself.
 */
export const scrollToShow = (
  strategy: Strategy,
  index: number,
  count: number,
  scroll: number
) => {
  const isLarge = (at: number) =>
    itemPlacement(strategy, index, at, count).size >= strategy.itemSize - 1;
  if (isLarge(scroll)) return scroll;
  const snaps = Array.from({ length: count }, (_, i) =>
    snapScroll(strategy, i, count)
  ).filter(isLarge);
  if (snaps.length === 0) return snapScroll(strategy, index, count);
  return snaps.reduce((nearest, at) =>
    Math.abs(at - scroll) < Math.abs(nearest - scroll) ? at : nearest
  );
};
