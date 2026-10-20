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
