import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  alpha,
  box,
  css,
  expectFocusRing,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/list is a Section with data-testid="list-<caseId>". A static item is found
// by its list item's text, an interactive one by its role and name.
type ListCaseId =
  | "one-line"
  | "two-line"
  | "three-line"
  | "leading"
  | "trailing"
  | "interactive"
  | "dividers"
  | "ordered"
  | "rtl";

const scope = (page: Page, caseId: ListCaseId) =>
  page.getByTestId(`list-${caseId}`);
// the item's container: the <li>'s own <div>, <a> or <button>
const item = (page: Page, caseId: ListCaseId, text: string) =>
  scope(page, caseId)
    .getByRole("listitem")
    .filter({ hasText: text })
    .locator("[data-ac-list-item]");
const part = (target: Locator, name: string) =>
  target.locator(`[data-ac-list-item-part=${name}]`);
const stateLayerOpacity = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el, "::before").opacity);
const radius = (target: Locator) => css(target, "border-top-left-radius");

test.describe("List", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/list");
  });

  test("is a list of list items, named by its aria-label, a <ul> or an <ol>", async ({
    page,
  }) => {
    const list = scope(page, "one-line").getByRole("list", { name: "Fruit" });
    await expect(list).toHaveJSProperty("tagName", "UL");
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(
      scope(page, "ordered").getByRole("list", { name: "Steps" })
    ).toHaveJSProperty("tagName", "OL");
  });

  // M3's Specs: 56px for one line, 72px for two, 88px for three
  test("items are 56px for one line, 72px for two and 88px for three", async ({
    page,
  }) => {
    for (const [caseId, text, height] of [
      ["one-line", "Apples", 56],
      ["two-line", "Ali Connors", 72],
      ["two-line", "Brunch this weekend?", 72],
      ["three-line", "Brunch this weekend?", 88],
      ["three-line", "Summer BBQ", 88],
    ] as const) {
      await expect
        .poll(async () => (await box(item(page, caseId, text))).height, text)
        .toBe(height);
    }
  });

  // M3's Specs: 16px at each end, 10px above and below, 12px between the parts
  test("pads its content 16px at each end and 10px above and below, 12px between parts", async ({
    page,
  }) => {
    const target = item(page, "trailing", "Inbox");
    const container = await box(target);
    const icon = await box(part(target, "leading"));
    const content = await box(part(target, "content"));
    const trailing = await box(part(target, "trailing"));
    expect(Math.round(icon.x - container.x)).toBe(16);
    expect(Math.round(content.x - (icon.x + icon.width))).toBe(12);
    expect(Math.round(trailing.x - (content.x + content.width))).toBe(12);
    expect(
      Math.round(container.x + container.width - (trailing.x + trailing.width))
    ).toBe(16);
    const threeLine = item(page, "three-line", "Brunch this weekend?");
    await expect(threeLine).toHaveCSS("padding-top", "10px");
    await expect(threeLine).toHaveCSS("padding-bottom", "10px");
  });

  // M3's Specs: middle-aligned, but top-aligned at three lines or 88px
  test("middle-aligns its parts, and top-aligns them at three lines", async ({
    page,
  }) => {
    const twoLine = item(page, "leading", "Ali Connors");
    const container = await box(twoLine);
    const avatar = await box(part(twoLine, "leading"));
    expect(avatar.y + avatar.height / 2).toBeCloseTo(
      container.y + container.height / 2,
      0
    );

    const wrapped = item(page, "three-line", "Summer BBQ");
    await expect(wrapped).toHaveAttribute("data-ac-list-item-lines", "3");
    const top = (await box(wrapped)).y;
    expect((await box(part(wrapped, "leading"))).y - top).toBe(10);
    expect((await box(part(wrapped, "content"))).y - top).toBe(10);
  });

  // M3's Specs: label Body Large on-surface, overline and trailing text Label Small, supporting
  // text Body Medium, those and the icons on-surface-variant, on a surface container
  test("takes M3's type and colors, in light and dark", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const onSurface = await resolvedColor(
        page,
        "var(--theme-color-on-surface)"
      );
      const variant = await resolvedColor(
        page,
        "var(--theme-color-on-surface-variant)"
      );

      const target = item(page, "three-line", "Brunch this weekend?");
      await expect(target).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface)")
      );
      const label = part(target, "label");
      await expect(label).toHaveCSS("color", onSurface);
      await expect(label).toHaveCSS("font-size", "16px");
      await expect(label).toHaveCSS("line-height", "24px");
      await expect(label).toHaveCSS("font-weight", "400");
      const overline = part(target, "overline");
      await expect(overline).toHaveCSS("color", variant);
      await expect(overline).toHaveCSS("font-size", "11px");
      await expect(overline).toHaveCSS("line-height", "16px");
      await expect(overline).toHaveCSS("font-weight", "500");
      const supporting = part(target, "supporting");
      await expect(supporting).toHaveCSS("color", variant);
      await expect(supporting).toHaveCSS("font-size", "14px");
      await expect(supporting).toHaveCSS("line-height", "20px");

      const inbox = item(page, "trailing", "Inbox");
      await expect(part(inbox, "leading")).toHaveCSS("color", variant);
      const trailingText = part(inbox, "trailing");
      await expect(trailingText).toHaveCSS("color", variant);
      await expect(trailingText).toHaveCSS("font-size", "11px");
      await expect(part(item(page, "trailing", "About"), "trailing")).toHaveCSS(
        "color",
        variant
      );
    }
  });

  // M3's Specs: 20px icons, a 40px circular primary-container avatar with a Title Medium letter,
  // a 56px image and a 100 by 56px or 114 by 64px video, both with 8px corners
  test("sizes and shapes each leading element as M3's Specs do", async ({
    page,
  }) => {
    const size = async (target: Locator) => {
      const { width, height } = await box(target);
      return [Math.round(width), Math.round(height)];
    };
    expect(
      await size(
        part(item(page, "leading", "Photos"), "leading").locator("svg")
      )
    ).toEqual([20, 20]);
    expect(
      await size(
        part(item(page, "trailing", "About"), "trailing").locator("svg")
      )
    ).toEqual([20, 20]);

    const letter = part(item(page, "leading", "Ali Connors"), "leading");
    expect(await size(letter)).toEqual([40, 40]);
    // a circle: corners of at least half its 40px
    expect(parseFloat(await radius(letter))).toBeGreaterThanOrEqual(20);
    await expect(letter).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-primary-container)")
    );
    await expect(letter).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-on-primary-container)")
    );
    await expect(letter).toHaveCSS("font-size", "16px");
    await expect(letter).toHaveCSS("font-weight", "500");
    const photo = part(item(page, "leading", "Lily MacDonald"), "leading");
    expect(await size(photo.locator("img"))).toEqual([40, 40]);

    const image = part(item(page, "leading", "Swiss cheese plant"), "leading");
    expect(await size(image)).toEqual([56, 56]);
    expect(await size(image.locator("img"))).toEqual([56, 56]);
    await expect(image).toHaveCSS("border-top-left-radius", "8px");

    const small = part(item(page, "leading", "Watering basics"), "leading");
    expect(await size(small)).toEqual([100, 56]);
    await expect(small).toHaveCSS("border-top-left-radius", "8px");
    const large = part(
      item(page, "leading", "Repotting a monstera"),
      "leading"
    );
    expect(await size(large)).toEqual([114, 64]);
  });

  test("leading media is decorative, so the label names the item", async ({
    page,
  }) => {
    await expect(
      part(item(page, "leading", "Photos"), "leading").locator("svg")
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("an item is a link or a button, named by its label and supporting text", async ({
    page,
  }) => {
    const list = scope(page, "interactive");
    await expect(
      list.getByRole("link", { name: "Network Wi-Fi, mobile data" })
    ).toHaveAttribute("href", "#network");
    await expect(
      list.getByRole("button", { name: "Account Signed in" })
    ).toHaveAttribute("type", "button");
    // the overline and trailing text describe it
    await expect(
      list.getByRole("link", { name: "Help" })
    ).toHaveAccessibleDescription("Support New");
    // a static item is neither
    await expect(
      list
        .getByRole("listitem")
        .filter({ hasText: "Version 2.4" })
        .locator("a, button")
    ).toHaveCount(0);
  });

  // M3's Specs: an on-surface state layer at 8% hovered, 10% focused and pressed
  test("an interactive item shows M3's state layer hovered, focused and pressed", async ({
    page,
  }) => {
    const target = item(page, "interactive", "Account");
    await expect.poll(() => stateLayerOpacity(target)).toBe("0");
    await target.hover();
    await expect.poll(() => stateLayerOpacity(target)).toBe("0.08");
    await page.mouse.down();
    await expect.poll(() => stateLayerOpacity(target)).toBe("0.1");
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await target.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => stateLayerOpacity(target)).toBe("0.1");
  });

  test("a static item shows no state layer or pointer", async ({ page }) => {
    const target = item(page, "interactive", "Version 2.4");
    await target.hover();
    expect(
      await target.evaluate((el) => getComputedStyle(el, "::before").content)
    ).toBe("none");
    await expect(target).toHaveCSS("cursor", "auto");
    expect(await radius(target)).toBe("4px");
  });

  // M3's Specs: corners of 4px at rest, 12px hovered, 16px focused or pressed
  test("an interactive item's corners morph from 4px to 12px hovered and 16px focused or pressed", async ({
    page,
  }) => {
    const target = item(page, "interactive", "Account");
    await expect.poll(() => radius(target)).toBe("4px");
    await target.hover();
    await expect.poll(() => radius(target)).toBe("12px");
    await page.mouse.down();
    await expect.poll(() => radius(target)).toBe("16px");
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await target.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => radius(target)).toBe("16px");
  });

  // M3's Specs: a 3px secondary focus indicator, inside the item
  test("a focused item shows an inset 3px secondary focus ring", async ({
    page,
  }) => {
    const target = item(page, "interactive", "Network");
    await target.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(target).toBeFocused();
    await expectFocusRing(target, { inset: true });
    expect(await css(target, "box-shadow")).toContain(
      `${await resolvedColor(page, "var(--theme-color-secondary)")} 0px 0px 0px 3px inset`
    );
  });

  // M3's Specs: disabled content on-surface at 38%
  test("a disabled item can't be used, its content on-surface at 38%, with no state layer", async ({
    page,
  }) => {
    const target = scope(page, "interactive").getByRole("button", {
      name: "Favorites",
    });
    await expect(target).toBeDisabled();
    for (const element of [part(target, "label"), part(target, "leading")]) {
      await expect
        .poll(async () => alpha(await css(element, "color")))
        .toBeCloseTo(0.38, 2);
    }
    await target.hover({ force: true });
    expect(await stateLayerOpacity(target)).toBe("0");
    expect(await radius(target)).toBe("4px");
  });

  // M3's Accessibility page: Tab reaches the list's first item, the arrow keys move through it,
  // wrapping at the ends, and Tab leaves it
  test("Tab enters at the first item and leaves the list; the arrow keys move between items and wrap", async ({
    page,
  }) => {
    const list = scope(page, "interactive");
    const network = list.getByRole("link", { name: /^Network/ });
    const account = list.getByRole("button", { name: /^Account/ });
    const help = list.getByRole("link", { name: /^Help/ });

    await page.getByRole("heading", { name: /^Interactive/ }).click();
    await page.keyboard.press("Tab");
    await expect(network).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(account).toBeFocused();
    // past the static item and the disabled one
    await page.keyboard.press("ArrowDown");
    await expect(help).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(network).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(help).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(account).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(help).toBeFocused();

    // one stop: Tab leaves the list, and Shift+Tab comes back to the item last focused
    await page.keyboard.press("Tab");
    await expect(
      list.getByRole("button", { name: "After the list" })
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(help).toBeFocused();
  });

  // M3's Accessibility page: Space or Enter activates an item, a link's too
  test("Space or Enter activates an item", async ({ page }) => {
    const list = scope(page, "interactive");
    const network = list.getByRole("link", { name: /^Network/ });
    await network.focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/#network$/);
    const help = list.getByRole("link", { name: /^Help/ });
    await help.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#help$/);

    const account = list.getByRole("button", { name: /^Account/ });
    await account.evaluate((el) => {
      el.dataset.clicks = "0";
      el.addEventListener("click", () => {
        el.dataset.clicks = String(Number(el.dataset.clicks) + 1);
      });
    });
    await account.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    await expect(account).toHaveAttribute("data-clicks", "2");
  });

  // M3's Specs: a 1px outline-variant divider between items, full width or 16px in at each end,
  // with nothing above or below it
  test("draws M3's dividers between items, full width or inset", async ({
    page,
  }) => {
    const color = await resolvedColor(
      page,
      "var(--theme-color-outline-variant)"
    );
    for (const [name, inset] of [
      ["Cities, full-width dividers", 0],
      ["Cities, inset dividers", 16],
    ] as const) {
      const list = scope(page, "dividers").getByRole("list", { name });
      const listBox = await box(list);
      const items = list.getByRole("listitem");
      const dividers = list.locator("[data-ac-list-item-part=divider]:visible");
      await expect(dividers).toHaveCount(2);
      for (let i = 0; i < 2; i++) {
        const line = await box(dividers.nth(i));
        expect(line.height).toBe(1);
        expect(line.x - listBox.x).toBe(inset);
        expect(listBox.x + listBox.width - (line.x + line.width)).toBe(inset);
        await expect(dividers.nth(i)).toHaveCSS("background-color", color);
        // nothing between the item above and the line
        const above = await box(items.nth(i).locator("[data-ac-list-item]"));
        expect(line.y).toBe(above.y + above.height);
      }
      await expect(dividers.first()).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("mirrors right to left, and the arrow keys follow the reading direction", async ({
    page,
  }) => {
    const target = item(page, "rtl", "الشبكة");
    const container = await box(target);
    const leading = await box(part(target, "leading"));
    const trailing = await box(part(target, "trailing"));
    expect(container.x + container.width - (leading.x + leading.width)).toBe(
      16
    );
    expect(trailing.x - container.x).toBe(16);
    // a chevron points the way the item leads, so it's mirrored; a gear isn't
    const chevron = part(item(page, "rtl", "الحساب"), "trailing").locator(
      "svg"
    );
    await expect(chevron).toHaveCSS("scale", "-1 1");
    await expect(part(target, "leading").locator("svg")).toHaveCSS(
      "scale",
      "none"
    );

    const list = scope(page, "rtl");
    await list.getByRole("link").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(list.getByRole("button")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(list.getByRole("link")).toBeFocused();
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("an item's colors, corners and state layer change at once", async ({
      page,
    }) => {
      const target = item(page, "interactive", "Account");
      await expect(target).toHaveCSS("transition-duration", "0s");
      expect(
        await target.evaluate(
          (el) => getComputedStyle(el, "::before").transitionDuration
        )
      ).toBe("0s");
    });
  });
});
