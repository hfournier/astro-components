/**
 * Converts a camelCase or PascalCase name to kebab-case, keeping runs of capitals (acronyms)
 * together.
 *
 * @param str - The name to convert, e.g. `"bgColor"` or `"HTMLElement"`.
 * @returns The kebab-case name, e.g. `"bg-color"` or `"html-element"`.
 */
export const camelToKebabCase = (str: string) => {
  return str
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, "$1-$2")
    .toLowerCase();
};

/**
 * Removes one trailing slash from a path, so `"/tests/"` and `"/tests"` compare equal. The root
 * path `"/"` is left as it is.
 *
 * @param path - A URL path, e.g. `"/components/button/"`.
 * @returns The path without its trailing slash, e.g. `"/components/button"`.
 */
export const trimSlash = (path: string) => path.replace(/(.)\/$/, "$1");

/**
 * Whether a link leads to the current page or to a section the current page is in: its href is
 * the current path, or a parent of it (`"/components"` for `"/components/button"`). Trailing
 * slashes are ignored. `"/"` only matches itself, or it would match every page.
 *
 * @param currentPath - The current page's path, e.g. `Astro.url.pathname`.
 * @param href - The link's href, a path such as `"/components"` or a `URL`. A missing href never
 * matches.
 * @returns `true` if the link is for the current page or one of its parents.
 */
export const isCurrentPath = (
  currentPath: string,
  href: string | URL | null | undefined
) => {
  if (href == null) return false;
  const path = trimSlash(currentPath);
  const target = trimSlash(typeof href === "string" ? href : href.pathname);
  return target === "/"
    ? path === "/"
    : path === target || path.startsWith(`${target}/`);
};

/**
 * Unwraps rendered slot HTML that is a single paragraph. In MDX, a component's children that
 * start on their own line (`<Button>\n  Label\n</Button>`) are parsed as a Markdown paragraph,
 * so a component that only holds inline text would otherwise render a `<p>` inside it.
 *
 * @param html - Rendered slot HTML, e.g. from `await Astro.slots.render("default")`.
 * @returns The paragraph's content when `html` is exactly one `<p>`, otherwise `html` unchanged.
 */
export const unwrapParagraph = (html: string) => {
  const content = html.match(/^\s*<p\b[^>]*>([\s\S]*)<\/p>\s*$/)?.[1];
  return content !== undefined && !/<\/?p\b/.test(content) ? content : html;
};

/**
 * Whether a Badge's `label` shows a count (a large badge), rather than a dot or no badge.
 *
 * @param badgeLabel - The Badge's `label`: a count, `""` for a dot, or `undefined` for no badge.
 * @returns `false` for `undefined`, `""` and `0` (or `"0"`), which Badge hides.
 */
export const isBadgeCount = (badgeLabel: string | number | undefined) =>
  badgeLabel !== undefined && badgeLabel !== "" && Number(badgeLabel) !== 0;

/**
 * The accessible name of an element that carries a Badge. A Badge is hidden from assistive tech,
 * so, as M3 asks, the element's name says what it shows after its label: a count, or for a dot,
 * "New notification" or the given description.
 *
 * @param label - The element's own name, e.g. `"Inbox"`.
 * @param badgeLabel - The Badge's `label`: a count, `""` for a dot, or `undefined` for no badge.
 * @param badgeDescription - What a dot means. Defaults to M3's `"New notification"`.
 * @returns The name, e.g. `"Inbox, 3"` or `"Updates, New notification"`, or `undefined` when
 * there's no badge (including a hidden `0`), so the element keeps its own name.
 */
export const badgedName = (
  label: string,
  badgeLabel: string | number | undefined,
  badgeDescription = "New notification"
) => {
  if (badgeLabel === "") return `${label}, ${badgeDescription}`;
  return isBadgeCount(badgeLabel) ? `${label}, ${badgeLabel}` : undefined;
};

/**
 * Closes a modal dialog on a click on its scrim, in browsers without `closedby` (Safari). Where
 * it's supported, `closedby="any"` on the dialog does this natively, and this does nothing. It
 * also does nothing for a dialog whose `closedby` isn't `"any"` when it's called, so a page that
 * sets its own `closedby` gets the same behaviour in every browser.
 *
 * Like Escape, the click fires a cancelable `cancel` first, and closes only if nothing prevents
 * it. (The platform's `cancel` is cancelable only after a user action, which a click is, so the
 * two agree.) The dialog's panel must fill it, so a click that lands on the dialog itself is on
 * its `::backdrop`. The press must start there too, as the platform's light dismiss asks, so a
 * text selection dragged out of the content doesn't close it.
 *
 * @param dialog - A modal `<dialog>` with `closedby="any"`, whose content fills it.
 */
export const closeOnScrimClick = (dialog: HTMLDialogElement) => {
  if (
    "closedBy" in HTMLDialogElement.prototype ||
    dialog.getAttribute("closedby") !== "any"
  )
    return;
  let pressedOnScrim = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressedOnScrim = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    const onScrim = event.target === dialog && pressedOnScrim;
    pressedOnScrim = false;
    if (
      onScrim &&
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }))
    )
      dialog.close("");
  });
};

/**
 * M3's window size classes as media queries, for `matchMedia`. They repeat theme.css's
 * `--breakpoint-*` (ADR-0014), which a script can't read in a media query, so keep the two in
 * step.
 */
export const breakpoints = {
  medium: "(width >= 37.5rem)",
  large: "(width >= 75rem)",
} as const;

/**
 * One of theme.css's motion springs, as timing for `element.animate()`, for motion CSS can't
 * transition, such as a change of place or an animation to an element's natural size. Read when
 * called, so it follows the page's current theme.
 *
 * @param name - The spring, e.g. `"fast-spatial"`, which reads `--theme-duration-spring-fast-spatial`
 * and `--ease-spring-fast-spatial`.
 * @returns The spring's duration in ms and its easing.
 */
export const springTiming = (
  name:
    | "fast-spatial"
    | "fast-effects"
    | "default-spatial"
    | "default-effects"
    | "slow-effects"
    | "standard-fast-spatial"
) => {
  const root = getComputedStyle(document.documentElement);
  return {
    duration: parseFloat(
      root.getPropertyValue(`--theme-duration-spring-${name}`)
    ),
    easing: root.getPropertyValue(`--ease-spring-${name}`).trim(),
  };
};

/**
 * Makes the rest of the page inert under a modal that isn't a `<dialog>`, such as a navigation
 * rail or drawer opened over it: every child of `<body>` except scripts, the scrim and those
 * holding one of `keep`. Only what it made inert is restored, so what the page made inert stays
 * that way.
 *
 * @param keep - The elements that stay usable, e.g. the open rail.
 * @param scrim - A selector for the modal's scrim, which stays clickable to close it.
 * @returns `setInert(isInert)`: `true` makes the rest of the page inert, `false` restores it.
 */
export const inertOutside = (keep: readonly Element[], scrim: string) => {
  const inerted: HTMLElement[] = [];
  return (isInert: boolean) => {
    if (!isInert) {
      inerted.splice(0).forEach((element) => (element.inert = false));
      return;
    }
    Array.from(document.body.children).forEach((element) => {
      if (
        element instanceof HTMLElement &&
        !element.inert &&
        !(element instanceof HTMLScriptElement) &&
        !element.matches(scrim) &&
        !keep.some((kept) => element.contains(kept))
      ) {
        element.inert = true;
        inerted.push(element);
      }
    });
  };
};

type WaveDrawing = {
  selector: string;
  phaseAnimation: string;
  draw: (root: HTMLElement) => boolean;
};

const waveScheduler = () => {
  const drawings: WaveDrawing[] = [];
  // Every indicator on the page, and how to draw it
  const tracked = new Map<HTMLElement, WaveDrawing>();
  // The ones on screen. One off screen isn't redrawn until it comes back.
  const visible = new Set<HTMLElement>();
  // The ones to draw next frame. One stays here only while its drawing can change.
  const stale = new Set<HTMLElement>();
  let frame = 0;

  const scheduleDraw = (root: HTMLElement) => {
    stale.add(root);
    frame ||= requestAnimationFrame(tick);
  };

  const requestDraw = (root: HTMLElement) => {
    if (visible.has(root)) scheduleDraw(root);
  };

  const tick = () => {
    frame = 0;
    const roots = [...stale];
    stale.clear();
    for (const root of roots) {
      const { draw, phaseAnimation } = tracked.get(root)!;
      const hasWave = draw(root);
      // A flat wave looks the same wherever its phase is, so its phase doesn't count. A root
      // that has just stopped moving was left stale, so it was drawn once more at rest, above.
      const isMoving = root
        .getAnimations({ subtree: true })
        .some(
          (animation) =>
            animation.playState === "running" &&
            (hasWave ||
              !(animation instanceof CSSAnimation) ||
              animation.animationName !== phaseAnimation)
        );
      if (isMoving) requestDraw(root);
    }
  };

  const rootsIn = (node: Element, selector: string) =>
    [
      ...(node.matches(selector) ? [node] : []),
      ...node.querySelectorAll(selector),
    ] as HTMLElement[];

  const visibilityObserver = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const root = target as HTMLElement;
      // an entry already queued can arrive after its root has been removed
      if (isIntersecting && tracked.has(root)) {
        visible.add(root);
        requestDraw(root);
      } else {
        visible.delete(root);
      }
    }
  });

  // The linear wave is drawn to its indicator's width
  const resizeObserver = new ResizeObserver((entries) => {
    for (const { target } of entries) requestDraw(target as HTMLElement);
  });

  // Drawn once wherever it is, so one that's never on screen still shows if the page is printed
  const track = (root: HTMLElement, drawing: WaveDrawing) => {
    tracked.set(root, drawing);
    visibilityObserver.observe(root);
    resizeObserver.observe(root);
    scheduleDraw(root);
  };

  const untrack = (root: HTMLElement) => {
    visibilityObserver.unobserve(root);
    resizeObserver.unobserve(root);
    tracked.delete(root);
    visible.delete(root);
    stale.delete(root);
  };

  // Indicators come and go with scripts, framework islands and Astro's ClientRouter, and a new
  // value (its `value` or `max`) has to be drawn even with no transition to wake the loop.
  new MutationObserver((records) => {
    for (const { target, addedNodes, removedNodes } of records) {
      if (target instanceof HTMLProgressElement && target.parentElement)
        requestDraw(target.parentElement);
      for (const drawing of drawings) {
        removedNodes.forEach((node) => {
          if (node instanceof Element)
            rootsIn(node, drawing.selector).forEach(
              (root) => root.isConnected || untrack(root)
            );
        });
        addedNodes.forEach((node) => {
          if (node instanceof Element)
            rootsIn(node, drawing.selector).forEach((root) =>
              track(root, drawing)
            );
        });
      }
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["value", "max"],
  });

  // Motion that starts on an indicator already drawn at rest, e.g. when the page stops asking
  // for reduced motion
  document.addEventListener("animationstart", ({ target }) => {
    for (const { selector } of drawings) {
      const root = (target as Element).closest<HTMLElement>(selector);
      if (root) requestDraw(root);
    }
  });

  return (drawing: WaveDrawing) => {
    drawings.push(drawing);
    document
      .querySelectorAll<HTMLElement>(drawing.selector)
      .forEach((root) => track(root, drawing));
  };
};

let addWaveDrawing: ReturnType<typeof waveScheduler> | undefined;

/**
 * Draws a component's wavy progress indicators from a script, in the one `requestAnimationFrame`
 * loop every such component shares. The loop runs only while an indicator's drawing can change:
 * its wave is travelling, or an indeterminate animation or a value or amplitude transition is
 * under way. Otherwise each indicator is drawn once per change, and the page stays idle. One
 * off screen is drawn when it's added, and not again until it comes back.
 *
 * @param component - The component, whose name prefixes its `data-*-shape="wavy"` attribute and
 * its `*-phase` keyframes, e.g. `"ac-progress-linear"`.
 * @param draw - Draws one indicator. Returns whether its wave has any height, as a flat wave
 * doesn't change as its phase runs.
 */
export const drawWaves = (
  component: "ac-progress-linear" | "ac-progress-circular",
  draw: WaveDrawing["draw"]
) => {
  addWaveDrawing ??= waveScheduler();
  addWaveDrawing({
    selector: `[data-${component}-shape="wavy"]`,
    phaseAnimation: `${component}-phase`,
    draw,
  });
};

/**
 * A slider's value as the browser keeps a range input's: within `min` and `max`, on a step from
 * `min` (the last whole one when `max` isn't), or anywhere between with step `"any"`.
 *
 * @param value - The value to snap, e.g. one the pointer is at.
 * @param range - The input's `min`, `max` and `step`.
 */
export const snapSliderValue = (
  value: number,
  { min, max, step }: { min: number; max: number; step: number | "any" }
) => {
  const clamped = Math.min(max, Math.max(min, value));
  if (step === "any") return clamped;
  const stepped = min + Math.round((clamped - min) / step) * step;
  return stepped > max ? stepped - step : stepped;
};

/**
 * The custom properties Slider's CSS draws its tracks and handles from (ADR-0033): the two
 * places its active track runs between, `from` and `to`. A standard slider's runs from the
 * track's start to its handle, a centered one's between the middle and its handle, and a range
 * one's between its handles. Each place is its fraction of the range; whether it's inset, a
 * handle on a stop between the ends, which Compose places 6px in from them; and whether it's a
 * handle, with a gap each side. The server renders them and the script sets them on each change,
 * so both draw a slider alike.
 *
 * @param slider - Its variant, range, whether it has stops, and its handles' values: one, or a
 * range slider's start and end.
 * @returns Each custom property's name and value, e.g. `"--ac-slider-to": "0.3"`.
 */
export const sliderPlaces = ({
  variant,
  min,
  max,
  hasStops,
  values,
}: {
  variant: "standard" | "centered" | "range";
  min: number;
  max: number;
  hasStops: boolean;
  values: readonly number[];
}) => {
  const placeOf = (value: number) => ({
    fraction: (value - min) / (max - min),
    inset: hasStops && value > min && value < max ? 1 : 0,
    handle: 1,
  });
  const trackStart = { fraction: 0, inset: 0, handle: 0 };
  const trackMiddle = { fraction: 0.5, inset: 0, handle: 0 };
  const [first = min, second = max] = values;
  const middle = min + (max - min) / 2;
  const places =
    variant === "range"
      ? { from: placeOf(first), to: placeOf(second) }
      : variant === "centered"
        ? {
            from: first <= middle ? placeOf(first) : trackMiddle,
            to: first >= middle ? placeOf(first) : trackMiddle,
          }
        : { from: trackStart, to: placeOf(first) };
  return Object.fromEntries(
    Object.entries(places).flatMap(([side, { fraction, inset, handle }]) => [
      [`--ac-slider-${side}`, String(fraction)],
      [`--ac-slider-${side}-inset`, String(inset)],
      [`--ac-slider-${side}-handle`, String(handle)],
    ])
  );
};

/**
 * Marks an element pressed, as `:active` would, from the primary pointer pressing it to its
 * release, and, if `isPressKey` is given, while a press key is held on an input inside it. For a
 * `<label>` drawn as a control around its native input, as Firefox doesn't reliably give `:active`
 * to either (ADR-0022, ADR-0024, ADR-0028).
 * Delegated from the document, so it covers elements added later.
 *
 * @param selector - The elements to mark, e.g. `"label[data-ac-base-chip]"`.
 * @param attribute - The mark, set to `""` while pressed, e.g. `"data-ac-base-chip-pressed"`.
 * @param isPressKey - Whether a key event's key presses the element, e.g. Space. Left out, keys
 * don't mark it.
 */
export const markPressed = (
  selector: string,
  attribute: string,
  isPressKey?: (event: KeyboardEvent) => boolean
) => {
  document.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const element = (event.target as Element).closest?.(selector);
    if (!element) return;
    element.setAttribute(attribute, "");
    const end = () => {
      element.removeAttribute(attribute);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  });
  if (!isPressKey) return;
  const elementOf = (target: EventTarget | null) =>
    target instanceof HTMLInputElement ? target.closest(selector) : null;
  document.addEventListener("keydown", (event) => {
    if (isPressKey(event) && !event.repeat)
      elementOf(event.target)?.setAttribute(attribute, "");
  });
  document.addEventListener("keyup", (event) => {
    if (isPressKey(event)) elementOf(event.target)?.removeAttribute(attribute);
  });
  document.addEventListener("focusout", (event) => {
    elementOf(event.target)?.removeAttribute(attribute);
  });
};

/**
 * A toolbar's classes for M3's standard and vibrant color styles, shared by ToolbarDocked and
 * ToolbarFloating, whose Specs give both the same roles (ADR-0036). `bg` is the container's
 * BaseWrapper background, which also gives its standard icon buttons their icon color
 * (on-surface-variant or on-primary-container). `toggles` re-points a tonal toggle icon button's
 * role tokens to the toolbar's button and selected-button colors.
 */
export const toolbarColorClasses = {
  standard: {
    bg: "surface-container",
    toggles:
      "[--theme-color-tonal-toggle:var(--theme-color-surface-container)] [--theme-color-on-tonal-toggle:var(--theme-color-on-surface-variant)] [--theme-color-tonal-toggle-selected:var(--theme-color-secondary-container)] [--theme-color-on-tonal-toggle-selected:var(--theme-color-on-secondary-container)]",
  },
  vibrant: {
    bg: "primary-container",
    toggles:
      "[--theme-color-tonal-toggle:var(--theme-color-primary-container)] [--theme-color-on-tonal-toggle:var(--theme-color-on-primary-container)] [--theme-color-tonal-toggle-selected:var(--theme-color-surface-container)] [--theme-color-on-tonal-toggle-selected:var(--theme-color-on-surface)]",
  },
} as const;

/**
 * Lets the arrow keys move between a toolbar's controls, as M3's Accessibility page asks ("Tab or
 * Arrows"), alongside Tab (ADR-0036). Left and right move to the previous or next control in the
 * order Tab takes, mirrored right to left; in a toolbar with `aria-orientation="vertical"`, up and
 * down do. They stop at the ends and skip disabled and hidden controls.
 *
 * A control that uses the arrow keys itself keeps them: a text field moves its caret, a slider its
 * value, a radio its selection. A group inside the toolbar that moves between its own items, such
 * as a ButtonGroup or ChipGroup, handles them first, as it listens on the document; this listens
 * on the window, after it, and moves on only once the group stops. Keys inside a popover or dialog
 * opened from the toolbar, such as a menu, are left to it.
 *
 * @param toolbarSelector - The toolbars it covers, e.g. `"[data-ac-toolbar-docked]"`.
 */
export const moveFocusWithArrows = (toolbarSelector: string) => {
  const tabbableSelector =
    "a[href], button, input, select, textarea, [tabindex], [contenteditable]";
  const ownsArrowsSelector = [
    "input:not([type=button], [type=checkbox], [type=color], [type=file], [type=image], [type=reset], [type=submit])",
    "textarea",
    "select",
    "[contenteditable]:not([contenteditable=false])",
    "[role=slider]",
    "[role=spinbutton]",
    "[role=textbox]",
    "[role=combobox]",
    "[role=radio]",
  ].join(", ");
  const layerSelector = "[popover], dialog";
  // Whether an element is in a popover or dialog opened from this toolbar
  const inLayerOf = (el: Element, toolbar: Element) =>
    el.closest(layerSelector)?.closest(toolbarSelector) === toolbar;

  // The toolbar's controls that Tab stops at, in its order
  const controlsOf = (toolbar: Element) =>
    [...toolbar.querySelectorAll<HTMLElement>(tabbableSelector)].filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.matches(":disabled") &&
        !inLayerOf(el, toolbar) &&
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== "hidden"
    );

  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const toolbar = target.closest(toolbarSelector);
    if (!toolbar || target.matches(ownsArrowsSelector)) return;
    if (inLayerOf(target, toolbar)) return;

    let forward: boolean;
    if (toolbar.getAttribute("aria-orientation") === "vertical") {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      forward = event.key === "ArrowDown";
    } else {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const isRtl = getComputedStyle(toolbar).direction === "rtl";
      forward = (event.key === "ArrowRight") !== isRtl;
    }
    const controls = controlsOf(toolbar);
    // the next control after the focused one, or the last before it, in document order, so it
    // also works from an item that Tab skips, such as a roving one in a group
    // (neither inside it nor holding it)
    const position = (el: Element) => target.compareDocumentPosition(el);
    const follows = (el: Element) =>
      !!(position(el) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      !target.contains(el);
    const precedes = (el: Element) =>
      !!(position(el) & Node.DOCUMENT_POSITION_PRECEDING) &&
      !el.contains(target);
    const next = forward ? controls.find(follows) : controls.findLast(precedes);
    if (!next) return;
    event.preventDefault();
    next.focus();
  });
};

/**
 * The nearest ancestor that scrolls vertically, or null for the window. Overflow alone isn't
 * enough: overflow-x: hidden makes overflow-y compute to auto on an element that never scrolls,
 * and an element fixed inside one still has the window scrolling under it.
 */
export const scrollerOf = (el: Element): Element | null => {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) break;
    if (
      node.scrollHeight > node.clientHeight &&
      /auto|scroll|overlay/.test(getComputedStyle(node).overflowY)
    )
      return node;
  }
  return null;
};

/**
 * The element, or its ancestor below its scroll container, that pins it there with `sticky` or
 * `fixed`, with its computed style; null when it scrolls with its container.
 *
 * @param el - The pinned component, e.g. an app bar.
 * @param scroller - Its scroll container, from `scrollerOf`, or null for the window.
 */
export const pinnedOf = (el: Element, scroller: Element | null) => {
  for (
    let node: Element | null = el;
    node && node !== scroller;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (style.position === "sticky" || style.position === "fixed")
      return { node: node as HTMLElement, style };
  }
  return null;
};
