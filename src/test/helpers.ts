import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** A CSS color value (usually a `var(--theme-color-*)` role) as the browser resolves it on the page. */
export async function resolvedColor(
  page: Page,
  cssValue: string
): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.color = value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssValue);
}

/** A color custom property as it resolves inside `el`, where a BaseWrapper may have overridden it. */
export const colorInside = (el: Locator, property: string) =>
  el.evaluate((node, p) => {
    const probe = document.createElement("div");
    probe.style.color = `var(${p})`;
    node.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, property);

export async function box(target: Locator) {
  const rect = await target.boundingBox();
  if (!rect) throw new Error("element has no bounding box");
  return rect;
}

/** Waits for the page's finite animations and transitions, so boxes measured after it are at rest. */
export const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().endTime !== Infinity
        )
        .map((animation) => animation.finished.catch(() => undefined))
    )
  );

/** The box of an element's own text: its first non-empty direct text node. */
export const textBox = (target: Locator) =>
  target.evaluate((el) => {
    const text = [...el.childNodes].find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    );
    if (!text) throw new Error("element has no text of its own");
    const range = document.createRange();
    range.selectNodeContents(text);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });

/**
 * Asserts the focused `target` shows the theme focus ring in the focus-ring-on-bg color it
 * inherits. This is the one place that knows how the ring is drawn: as Tailwind's ring
 * box-shadows, either ring-offset-2 + ring-3 (a 2px spread in the wrapper's background, then
 * the ring color out to 5px) or, `inset`, a single 3px inset spread. `pseudo` reads it off a
 * pseudo-element instead. The caller focuses the target; the ring transitions in, so this polls.
 */
export async function expectFocusRing(
  target: Locator,
  { inset = false, pseudo }: { inset?: boolean; pseudo?: "::after" } = {}
): Promise<void> {
  const parent = target.locator("..");
  const ring = await colorInside(parent, "--theme-color-focus-ring-on-bg");
  const expected = inset
    ? `${ring} 0px 0px 0px 3px inset`
    : `${await colorInside(parent, "--theme-color-wrapper-bg")} 0px 0px 0px 2px, ${ring} 0px 0px 0px 5px`;

  await expect
    .poll(() =>
      target.evaluate(
        (el, p) => getComputedStyle(el, p ?? null).boxShadow,
        pseudo
      )
    )
    .toContain(expected);
}
