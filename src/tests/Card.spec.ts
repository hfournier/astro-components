import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  alpha,
  box,
  castsNoShadow,
  colorInside,
  css,
  elevation,
  resolvedColor,
  settled,
} from "./support/helpers";

// Each case on /tests/card is a Section with data-testid="card-<caseId>"
type CardCaseId =
  "styles" | "interactive" | "actions" | "disabled" | "dragged" | "rtl";

const section = (page: Page, caseId: CardCaseId) =>
  page.getByTestId(`card-${caseId}`);

// A card is the element marked data-ac-card; an interactive one's primary action is a link or
// button inside it
const cardOf = (target: Locator) =>
  target.locator("xpath=ancestor-or-self::*[@data-ac-card][1]");

const staticCard = (page: Page, text: string) =>
  section(page, "styles").locator("[data-ac-card]", { hasText: text });

const action = (
  page: Page,
  caseId: CardCaseId,
  role: "link" | "button",
  name: string
) => section(page, caseId).getByRole(role, { name, exact: true });

const stateLayerOpacity = (card: Locator) =>
  card.evaluate((el) => getComputedStyle(el, "::before").opacity);

// The card's inside, within any outline: what its action covers, as the card clips to it
const innerBox = async (card: Locator) => {
  const outer = await box(card);
  const { clientLeft, clientTop, clientWidth, clientHeight } =
    await card.evaluate((el) => ({
      clientLeft: el.clientLeft,
      clientTop: el.clientTop,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    }));
  return {
    x: outer.x + clientLeft,
    y: outer.y + clientTop,
    width: clientWidth,
    height: clientHeight,
  };
};

// The pointer over some text on the card. Playwright's own hover and click refuse it, since the
// card's action takes the pointer there, which is what's under test.
const pointAt = async (page: Page, target: Locator) => {
  await target.scrollIntoViewIfNeeded();
  const { x, y, width, height } = await box(target);
  await page.mouse.move(x + width / 2, y + height / 2);
};

const shadowOf = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el).boxShadow);

test.describe("Card", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/card");
  });

  // M3's Accessibility page: a non-actionable card is purely a container, with no role and no
  // tab stop; the actions inside it are the tab stops
  test("a static card is a container with no role, its own buttons the tab stops", async ({
    page,
  }) => {
    const card = staticCard(page, "Elevated");
    await expect(card).toHaveJSProperty("tagName", "ARTICLE");
    await expect(card).not.toHaveAttribute("tabindex");
    await expect(card.getByRole("link")).toHaveCount(0);
    await section(page, "styles").getByRole("heading", { level: 2 }).click();
    await page.keyboard.press("Tab");
    await expect(card.getByRole("button", { name: "Buy" })).toBeFocused();
  });

  // M3's Specs: 12dp corners; elevated on surface-container-low at level 1, filled on
  // surface-container-highest, outlined on surface in a 1dp outline-variant outline, and the
  // content on-surface
  test("each style takes M3's shape and colors, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const role = (name: string) =>
        resolvedColor(page, `var(--theme-color-${name})`);
      const onSurface = await role("on-surface");

      const elevated = staticCard(page, "Elevated");
      const filled = staticCard(page, "Filled");
      const outlined = staticCard(page, "Outlined");
      for (const card of [elevated, filled, outlined]) {
        await expect(card).toHaveCSS("border-top-left-radius", "12px");
        await expect(card).toHaveCSS("border-bottom-right-radius", "12px");
        await expect(card).toHaveCSS("color", onSurface);
      }

      await expect(elevated).toHaveCSS(
        "background-color",
        await role("surface-container-low")
      );
      expect(await shadowOf(elevated)).toContain(await elevation(page, 1));

      await expect(filled).toHaveCSS(
        "background-color",
        await role("surface-container-highest")
      );
      expect(await castsNoShadow(filled)).toBe(true);

      await expect(outlined).toHaveCSS(
        "background-color",
        await role("surface")
      );
      await expect(outlined).toHaveCSS("border-top-width", "1px");
      await expect(outlined).toHaveCSS(
        "border-top-color",
        await role("outline-variant")
      );
      expect(await castsNoShadow(outlined)).toBe(true);
    }
  });

  // The card is a BaseWrapper, so a button or link on it takes the roles that suit its surface
  test("sets the wrapper background to its own color, for what sits on it", async ({
    page,
  }) => {
    const card = staticCard(page, "Filled");
    expect(await colorInside(card, "--theme-color-wrapper-bg")).toBe(
      await resolvedColor(page, "var(--theme-color-surface-container-highest)")
    );
  });

  // M3's Accessibility page: non-actionable cards have no hover state
  test("a static card shows no state layer and keeps its elevation on hover", async ({
    page,
  }) => {
    const card = staticCard(page, "Elevated");
    await pointAt(page, card.locator("p"));
    await settled(page);
    expect(await stateLayerOpacity(card)).toBe("0");
    expect(await shadowOf(card)).toContain(await elevation(page, 1));
  });

  // M3's Accessibility page: a directly actionable card has the link or button role
  test("an interactive card is a link or a button named through aria attributes", async ({
    page,
  }) => {
    const link = action(page, "interactive", "link", "Lisbon");
    await expect(link).toHaveAttribute("href", "#card-elevated");
    const button = action(page, "interactive", "button", "Open Faro");
    await expect(button).toHaveAttribute("type", "button");
  });

  test("its action covers the whole card, so a click anywhere on it is the action's", async ({
    page,
  }) => {
    const link = action(page, "interactive", "link", "Porto");
    const card = cardOf(link);
    const cardBox = await innerBox(card);
    const linkBox = await box(link);
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(linkBox[key]).toBeCloseTo(cardBox[key], 0);
    }
    await pointAt(page, card.getByText("A weekend of bridges"));
    await page.mouse.down();
    await page.mouse.up();
    await expect(page).toHaveURL(/#card-filled$/);
  });

  // M3's Accessibility page: Tab moves to the card, then to each actionable element in it
  test("buttons inside an interactive card are their own tab stops, after the card", async ({
    page,
  }) => {
    const link = action(page, "actions", "link", "Night drive");
    await link.focus();
    for (const name of ["More options", "Play", "Add to queue"]) {
      await page.keyboard.press("Tab");
      await expect(
        section(page, "actions").getByRole("button", { name, exact: true })
      ).toBeFocused();
    }
  });

  test("a button inside an interactive card takes its own clicks, not the card's", async ({
    page,
  }) => {
    const card = cardOf(action(page, "actions", "link", "Night drive"));
    for (const name of ["Play", "More options"]) {
      const inner = section(page, "actions").getByRole("button", {
        name,
        exact: true,
      });
      await inner.hover();
      await settled(page);
      // the card's own state layer stays off while one of its buttons is hovered
      expect(await stateLayerOpacity(card), name).toBe("0");
      await inner.click();
      await expect(page, name).not.toHaveURL(/#card-album$/);
    }
  });

  // M3's Specs: an on-surface state layer at 8% hovered, 10% focused or pressed
  test("shows M3's state layer hovered, focused and pressed", async ({
    page,
  }) => {
    const link = action(page, "interactive", "link", "Porto");
    const card = cardOf(link);
    await expect.poll(() => stateLayerOpacity(card)).toBe("0");
    await pointAt(page, card.getByText("A weekend of bridges"));
    await expect.poll(() => stateLayerOpacity(card)).toBe("0.08");
    await page.mouse.down();
    await expect.poll(() => stateLayerOpacity(card)).toBe("0.1");
    await page.mouse.up();
    await page.mouse.move(0, 0);
    // keyboard focus, on the button card: WebKit's Tab skips links by default
    const button = action(page, "interactive", "button", "Open Faro");
    const buttonCard = cardOf(button);
    await link.focus();
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await expect.poll(() => stateLayerOpacity(buttonCard)).toBe("0.1");
    await expect
      .poll(() =>
        buttonCard.evaluate(
          (el) => getComputedStyle(el, "::before").backgroundColor
        )
      )
      .toBe(await resolvedColor(page, "var(--theme-color-on-surface)"));
  });

  // M3's Specs: elevated rests at 1dp and rises to 3dp (level 2) hovered, 1dp pressed or
  // focused; filled and outlined rest at 0 and rise to 1dp (level 1) hovered, 0 pressed
  test("rises on hover, as M3's Specs give each style", async ({ page }) => {
    const cases = [
      ["Lisbon", "link", 1, 2],
      ["Porto", "link", 0, 1],
      ["Open Faro", "button", 0, 1],
    ] as const;
    for (const [name, role, rest, hovered] of cases) {
      const target = action(page, "interactive", role, name);
      const card = cardOf(target);
      const expectLevel = async (level: 0 | 1 | 2, label: string) => {
        if (level === 0)
          await expect
            .poll(() => castsNoShadow(card), `${name} ${label}`)
            .toBe(true);
        else
          await expect
            .poll(() => shadowOf(card), `${name} ${label}`)
            .toContain(await elevation(page, level));
      };
      await expectLevel(rest, "at rest");
      await target.hover();
      await expectLevel(hovered, "hovered");
      // pressed, M3 brings it back to its resting level
      await page.mouse.down();
      await expectLevel(rest, "pressed");
      // released before leaving: WebKit starts dragging a link the pointer leaves pressed
      await page.mouse.up();
      await page.mouse.move(0, 0);
      await expectLevel(rest, "left");
    }
  });

  // M3's Specs: a 3dp focus indicator, 2dp outside the card, in secondary; a focused outlined
  // card's outline turns on-surface
  test("keyboard-focused, it shows M3's focus indicator around the card", async ({
    page,
  }) => {
    const button = action(page, "interactive", "button", "Open Faro");
    const card = cardOf(button);
    await action(page, "interactive", "link", "Porto").focus();
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await expect(card).toHaveCSS("outline-style", "solid");
    await expect(card).toHaveCSS("outline-width", "3px");
    await expect(card).toHaveCSS("outline-offset", "2px");
    await expect(card).toHaveCSS(
      "outline-color",
      await resolvedColor(page, "var(--theme-color-secondary)")
    );
    await expect(card).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-on-surface)")
    );

    // a pointer focus shows no indicator
    await page.mouse.move(0, 0);
    await action(page, "interactive", "link", "Porto").click();
    await expect(
      cardOf(action(page, "interactive", "link", "Porto"))
    ).toHaveCSS("outline-style", "none");
  });

  // M3's Specs: disabled content on-surface at 38%; elevated on surface at level 1, filled on
  // surface-variant at 38% over its container, outlined in an outline at 12%
  test("disabled, it takes M3's disabled colors and can't be focused", async ({
    page,
  }) => {
    const target = (name: string) => action(page, "disabled", "button", name);
    for (const name of [
      "Elevated disabled",
      "Filled disabled",
      "Outlined disabled",
    ]) {
      await expect(target(name)).toBeDisabled();
      const card = cardOf(target(name));
      await expect
        .poll(async () => alpha(await css(card, "color")), name)
        .toBeCloseTo(0.38, 2);
      await card.hover({ force: true });
      await settled(page);
      expect(await stateLayerOpacity(card), name).toBe("0");
      await expect(target(name)).toHaveCSS("cursor", "default");
    }

    const elevated = cardOf(target("Elevated disabled"));
    await expect(elevated).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-surface)")
    );
    expect(await shadowOf(elevated)).toContain(await elevation(page, 1));

    const filled = cardOf(target("Filled disabled"));
    await expect(filled).toHaveCSS(
      "background-color",
      await resolvedColor(
        page,
        "color-mix(in srgb, var(--theme-color-surface-variant) 38%, var(--theme-color-surface-container-highest))"
      )
    );

    const outlined = cardOf(target("Outlined disabled"));
    await expect
      .poll(async () => alpha(await css(outlined, "border-top-color")))
      .toBeCloseTo(0.12, 2);

    // Tab skips every disabled card
    await section(page, "disabled").getByRole("heading").click();
    await page.keyboard.press("Tab");
    await expect(section(page, "disabled").locator(":focus")).toHaveCount(0);
  });

  // M3's Specs: dragged, elevated rises to 8dp (level 4), filled and outlined to 6dp (level 3),
  // with a 16% state layer
  test("dragged, a draggable card rises and shows a 16% state layer, settling when dropped", async ({
    page,
  }) => {
    for (const [name, level] of [
      ["Elevated drag", 4],
      ["Filled drag", 3],
      ["Outlined drag", 3],
    ] as const) {
      const card = section(page, "dragged").locator("[data-ac-card]", {
        hasText: name,
      });
      await card.dispatchEvent("dragstart");
      await expect(card).toHaveAttribute("data-ac-card-dragged", "");
      await expect
        .poll(() => shadowOf(card), name)
        .toContain(await elevation(page, level));
      await expect.poll(() => stateLayerOpacity(card), name).toBe("0.16");
      await card.dispatchEvent("dragend");
      await expect(card).not.toHaveAttribute("data-ac-card-dragged");
    }
  });

  test("mirrors right to left, its action still covering it", async ({
    page,
  }) => {
    const link = action(page, "rtl", "link", "لشبونة");
    const card = cardOf(link);
    const cardBox = await innerBox(card);
    expect((await box(link)).width).toBeCloseTo(cardBox.width, 0);
    const more = section(page, "rtl").getByRole("button", {
      name: "خيارات أخرى",
    });
    const moreBox = await box(more);
    // the overflow button sits at the card's start, its left edge right to left
    expect(moreBox.x - cardBox.x).toBeLessThan(
      cardBox.x + cardBox.width - (moreBox.x + moreBox.width)
    );
  });
});
