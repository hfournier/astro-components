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
