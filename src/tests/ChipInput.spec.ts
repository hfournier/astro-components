import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  alpha,
  box,
  castsNoShadow,
  expectFocusRing,
  resolvedColor,
  settled,
  textBox,
} from "./support/helpers";

// Each case on /tests/chip-input is a Section with data-testid="chip-input-<caseId>". The labels
// case's chip sets removeLabel and editLabel, in French.
type ChipCaseId =
  "styles" | "disabled" | "remove" | "edit" | "popover" | "rtl" | "labels";

// The chip: its wrapper, around the body and the remove button
const chip = (page: Page, caseId: ChipCaseId, name: string) =>
  page
    .getByTestId(`chip-input-${caseId}`)
    .locator("[data-ac-chip-input]")
    .filter({ has: page.getByText(name, { exact: true }) });

const part = (
  target: Locator,
  name: "body" | "remove" | "label" | "avatar" | "edit"
) => target.locator(`[data-ac-chip-input-part=${name}]`);

const leadingIcon = (target: Locator) =>
  part(target, "body").locator("[data-ac-base-chip-part=leading-icon]");

const stateLayer = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el, "::before").getPropertyValue(p),
    property
  );

// rounded-full: a radius of at least half its size
const radius = (target: Locator) =>
  target.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));

// How far the label's text starts from the chip's start edge, and ends from its end edge,
// rounded, mirrored right to left
const labelInsets = async (target: Locator) => {
  await settled(target.page());
  const outer = await box(target);
  const text = await textBox(part(target, "label"));
  const rtl = await target.evaluate(
    (el) => getComputedStyle(el).direction === "rtl"
  );
  const left = text.x - outer.x;
  const right = outer.x + outer.width - (text.x + text.width);
  return (rtl ? [right, left] : [left, right]).map(Math.round);
};

// Records each `remove` and `change` a chip fires, by the chip's label, on window.__chipEvents
const recordEvents = (page: Page) =>
  page.evaluate(() => {
    const events: string[] = [];
    (window as unknown as { __chipEvents: string[] }).__chipEvents = events;
    for (const type of ["remove", "change"])
      document.addEventListener(type, (event) => {
        // the edit field's own change shouldn't reach the page
        if (!(event instanceof CustomEvent)) {
          events.push(`native:${type}`);
          return;
        }
        const label = (event.target as Element).querySelector?.(
          "[data-ac-chip-input-part=label]"
        );
        if (!label) return;
        const detail = (event as CustomEvent<{ value?: string }>).detail;
        events.push(
          `${type}:${label.textContent}${detail?.value ? `>${detail.value}` : ""}`
        );
      });
  });
const recorded = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __chipEvents: string[] }).__chipEvents
  );

// Records each animation a container-transform popover runs, on window.__animations: the
// container's (the popover) or its content's, with its clip-path insets and opacity from first
// keyframe to last, and its timing
type RecordedAnimation = {
  part: "container" | "content";
  clip?: string[];
  opacity?: number[];
  delay: number;
  duration: number;
  easing: string;
};
const recordAnimations = (page: Page) =>
  page.evaluate(() => {
    const recorded: RecordedAnimation[] = [];
    (window as unknown as { __animations: RecordedAnimation[] }).__animations =
      recorded;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      // keyframes as one array per property
      const frames = keyframes as PropertyIndexedKeyframes;
      const timing = options as KeyframeAnimationOptions;
      const popover = this.closest("[data-ac-overlay-transition]");
      if (popover)
        recorded.push({
          part: this === popover ? "container" : "content",
          clip: (frames.clipPath as string[] | undefined)?.map(String),
          opacity: (frames.opacity as number[] | undefined)?.map(Number),
          delay: Number(timing?.delay ?? 0),
          duration: Number(timing?.duration ?? 0),
          easing: String(timing?.easing ?? "linear"),
        });
      return animate.call(this, keyframes, options);
    };
  });
const recordedSoFar = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __animations: RecordedAnimation[] }).__animations
  );
// The animations recorded, once there are some: opening, they start on the frame after the
// popover opens
const animations = async (page: Page) => {
  await expect
    .poll(async () => (await recordedSoFar(page)).length)
    .toBeGreaterThan(0);
  return recordedSoFar(page);
};

// A clip-path inset() as its top, right, bottom and left insets, and its corner radius
type Inset = { insets: number[]; radius: number };
const parseInset = (value: string): Inset => {
  const [box, corner] = value.replace(/^inset\(|\)$/g, "").split(" round ");
  return {
    insets: box.trim().split(/\s+/).map(parseFloat),
    radius: parseFloat(corner ?? "0"),
  };
};
// The container's clip, from its first keyframe to its last
const clipFrom = async (page: Page) => {
  const clip = (await animations(page)).find(
    (animation) => animation.clip
  )?.clip;
  expect(clip).toBeDefined();
  return {
    from: parseInset(clip!.at(0)!),
    to: parseInset(clip!.at(-1)!),
  };
};
// The chip's box within the popover's, as inset() insets
const insetsOf = (
  chipBox: { x: number; y: number; width: number; height: number },
  popoverBox: { x: number; y: number; width: number; height: number }
) => [
  chipBox.y - popoverBox.y,
  popoverBox.x + popoverBox.width - (chipBox.x + chipBox.width),
  popoverBox.y + popoverBox.height - (chipBox.y + chipBox.height),
  chipBox.x - popoverBox.x,
];
const expectInsets = (clip: Inset, expected: number[]) =>
  expect(clip.insets.map(Math.round)).toEqual(expected.map(Math.round));

test.describe("ChipInput", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/chip-input");
  });

  // M3's Accessibility page: a chip with two actions is named by its content, then "Remove
  // {chip content}"; its role is a button, here a toggle for its selected state (ADR-0025)
  test("is a toggle button named by its label, beside a remove button named after it", async ({
    page,
  }) => {
    const styles = page.getByTestId("chip-input-styles");
    const body = styles.getByRole("button", {
      name: "Ziad Aouad",
      exact: true,
    });
    await expect(body).toHaveAttribute("aria-pressed", "false");
    await expect(
      styles.getByRole("button", { name: "Ping Qiang", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      styles.getByRole("button", { name: "Remove Ziad Aouad", exact: true })
    ).toBeVisible();
    // the avatar is decorative, so the chip is still named by its label alone
    await expect(
      styles.getByRole("button", { name: "Lily MacDonald", exact: true })
    ).toBeVisible();
    await expect(
      leadingIcon(chip(page, "styles", "Holiday photos")).locator("svg")
    ).toHaveAttribute("aria-hidden", "true");
  });

  test('names its remove and edit controls by removeLabel and editLabel, or "Remove" and "Edit" without them', async ({
    page,
  }) => {
    const labels = page.getByTestId("chip-input-labels");
    await expect(
      labels.getByRole("button", { name: "Retirer Lisbonne", exact: true })
    ).toBeVisible();
    await part(chip(page, "labels", "Lisbonne"), "body").click();
    await expect(
      labels.getByRole("textbox", { name: "Modifier Lisbonne", exact: true })
    ).toBeFocused();

    await expect(
      page
        .getByTestId("chip-input-styles")
        .getByRole("button", { name: "Remove Ziad Aouad", exact: true })
    ).toBeVisible();
    await part(chip(page, "edit", "ziad@example.com"), "body").click();
    await expect(
      page
        .getByTestId("chip-input-edit")
        .getByRole("textbox", { name: "Edit ziad@example.com", exact: true })
    ).toBeFocused();
  });

  // M3's Guidelines: a tap selects the chip; Space or Enter does too (M3's Accessibility page)
  test("a click, Space or Enter selects and deselects it", async ({ page }) => {
    const body = part(chip(page, "styles", "Ziad Aouad"), "body");
    await body.click();
    await expect(body).toHaveAttribute("aria-pressed", "true");
    await body.click();
    await expect(body).toHaveAttribute("aria-pressed", "false");
    await body.focus();
    await page.keyboard.press("Space");
    await expect(body).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(body).toHaveAttribute("aria-pressed", "false");
  });

  // M3's Specs: 32dp tall, 8dp corners, Label Large; 12dp before the label, 8dp before an 18dp
  // icon and 4dp before a 24dp circular avatar, each 8dp from the label; the 18dp remove icon 8dp
  // from the label and 8dp from the end
  test("takes M3's measurements, with a label, an icon or an avatar", async ({
    page,
  }) => {
    const plain = chip(page, "styles", "Ziad Aouad");
    const body = part(plain, "body");
    await expect(body).toHaveCSS("height", "32px");
    await expect(body).toHaveCSS("border-top-left-radius", "8px");
    await expect(body).toHaveCSS("font-size", "14px");
    await expect(body).toHaveCSS("line-height", "20px");
    await expect(body).toHaveCSS("font-weight", "500");
    expect(await labelInsets(plain)).toEqual([12, 34]);
    expect(await labelInsets(chip(page, "styles", "Holiday photos"))).toEqual([
      34, 34,
    ]);
    const withAvatar = chip(page, "styles", "Lily MacDonald");
    expect(await labelInsets(withAvatar)).toEqual([36, 34]);
    const avatar = await box(part(withAvatar, "avatar"));
    expect([avatar.width, avatar.height]).toEqual([24, 24]);
    expect(avatar.x - (await box(withAvatar)).x).toBeCloseTo(4, 0);
    expect(await radius(part(withAvatar, "avatar"))).toBeGreaterThanOrEqual(12);

    const icon = await box(part(plain, "remove").locator("svg"));
    const outer = await box(plain);
    expect([icon.width, icon.height]).toEqual([18, 18]);
    expect(Math.round(outer.x + outer.width - (icon.x + icon.width))).toBe(8);
    expect(Math.round(icon.y + icon.height / 2)).toBe(
      Math.round(outer.y + outer.height / 2)
    );
  });

  // M3's Specs: the remove icon's target is at least 48dp; M3's Guidelines: the chip is at least
  // 88dp wide, so that target doesn't cover its primary action
  test("its remove button has a 48px target, and the chip is at least 88px wide", async ({
    page,
  }) => {
    const target = part(chip(page, "styles", "Ziad Aouad"), "remove");
    const size = await target.evaluate((el) => {
      const after = getComputedStyle(el, "::after");
      return [after.width, after.height];
    });
    expect(size).toEqual(["48px", "48px"]);
    const short = page
      .getByTestId("chip-input-rtl")
      .locator("[data-ac-chip-input]")
      .last();
    expect((await box(short)).width).toBeGreaterThanOrEqual(88);
  });

  // M3's Specs and Compose's InputChipTokens: unselected, the label, icon and remove icon are
  // on-surface-variant on an outline-variant outline; selected, the container is
  // secondary-container with no outline, the label and remove icon on-secondary-container and the
  // icon primary
  test("takes M3's colors, selected and not, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const role = (name: string) =>
        resolvedColor(page, `var(--theme-color-${name})`);
      const transparent = "rgba(0, 0, 0, 0)";

      const unselected = chip(page, "styles", "Holiday photos");
      const body = part(unselected, "body");
      await expect(body).toHaveCSS("background-color", transparent);
      await expect(body).toHaveCSS(
        "border-top-color",
        await role("outline-variant")
      );
      await expect(body).toHaveCSS("border-top-width", "1px");
      await expect(body).toHaveCSS("color", await role("on-surface-variant"));
      await expect(leadingIcon(unselected).locator("svg")).toHaveCSS(
        "color",
        await role("on-surface-variant")
      );
      await expect(part(unselected, "remove")).toHaveCSS(
        "color",
        await role("on-surface-variant")
      );
      expect(await castsNoShadow(body)).toBe(true);

      const selected = chip(page, "styles", "Beach photos");
      const selectedBody = part(selected, "body");
      await expect(selectedBody).toHaveCSS(
        "background-color",
        await role("secondary-container")
      );
      await expect(selectedBody).toHaveCSS("border-top-color", transparent);
      await expect(selectedBody).toHaveCSS(
        "color",
        await role("on-secondary-container")
      );
      await expect(leadingIcon(selected).locator("svg")).toHaveCSS(
        "color",
        await role("primary")
      );
      await expect(part(selected, "remove")).toHaveCSS(
        "color",
        await role("on-secondary-container")
      );
    }
  });

  // M3's Specs: the body's state layer is the label's color, 8% hovered and 10% pressed; the
  // remove button's is its own circle, and hovering it leaves the body's off
  test("the body and the remove button each have their own state layer", async ({
    page,
  }) => {
    const target = chip(page, "styles", "Ping Qiang");
    const body = part(target, "body");
    await body.hover({ position: { x: 20, y: 16 } });
    await expect.poll(() => stateLayer(body, "opacity")).toBe("0.08");
    expect(await stateLayer(body, "background-color")).toBe(
      await resolvedColor(page, "var(--theme-color-on-secondary-container)")
    );
    await page.mouse.down();
    await expect.poll(() => stateLayer(body, "opacity")).toBe("0.1");
    await page.mouse.up();

    const remove = part(target, "remove");
    await remove.hover();
    await expect.poll(() => stateLayer(remove, "opacity")).toBe("0.08");
    await expect.poll(() => stateLayer(body, "opacity")).toBe("0");
    expect(await radius(remove)).toBeGreaterThanOrEqual(12);
    await page.mouse.down();
    await expect.poll(() => stateLayer(remove, "opacity")).toBe("0.1");
    await expect.poll(() => stateLayer(body, "opacity")).toBe("0");
    await page.mouse.up();
  });

  // M3's Accessibility page: the chip's content and its remove icon are two focusable elements;
  // M3's states show the focus ring around the chip, or around the remove icon alone
  test("Tab reaches the body, then the remove button, each with its own focus ring", async ({
    page,
  }) => {
    const target = chip(page, "styles", "Ziad Aouad");
    const body = part(target, "body");
    const remove = part(target, "remove");
    await body.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(body).toBeFocused();
    await expectFocusRing(body);
    await expect(body).toHaveCSS(
      "border-top-color",
      await resolvedColor(page, "var(--theme-color-on-surface-variant)")
    );
    await page.keyboard.press("Tab");
    await expect(remove).toBeFocused();
    await expect
      .poll(() => remove.evaluate((el) => getComputedStyle(el).boxShadow))
      .toContain(
        `${await resolvedColor(page, "var(--theme-color-focus-ring-on-bg)")} 0px 0px 0px 3px`
      );
    expect(await castsNoShadow(body)).toBe(true);
  });

  // M3's Specs: the label and icons on-surface at 38%, the avatar at 38% opacity; unselected, the
  // outline on-surface at 12%; selected, the container on-surface at 12% and no outline
  test("disabled, it takes M3's disabled colors, and neither control works", async ({
    page,
  }) => {
    const flat = chip(page, "disabled", "Flat disabled");
    const body = part(flat, "body");
    await expect(body).toBeDisabled();
    await expect(part(flat, "remove")).toBeDisabled();
    expect(alpha(await body.evaluate((el) => getComputedStyle(el).color))).toBe(
      0.38
    );
    expect(
      alpha(
        await part(flat, "remove").evaluate((el) => getComputedStyle(el).color)
      )
    ).toBe(0.38);
    expect(
      alpha(await body.evaluate((el) => getComputedStyle(el).borderTopColor))
    ).toBe(0.12);
    const selected = part(chip(page, "disabled", "Selected disabled"), "body");
    expect(
      alpha(
        await selected.evaluate((el) => getComputedStyle(el).backgroundColor)
      )
    ).toBe(0.12);
    await expect(selected).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(
      part(chip(page, "disabled", "Avatar disabled"), "avatar")
    ).toHaveCSS("opacity", "0.38");
    await body.click({ force: true });
    await expect(body).toHaveAttribute("aria-pressed", "false");
  });

  // M3's Accessibility page: Backspace or Delete removes the focused input chip. Focus moves to
  // the next chip, else the previous one, skipping a disabled one, and the chip fires `remove`.
  test("its remove button, Backspace or Delete removes it, and focus moves to a neighbour", async ({
    page,
  }) => {
    await recordEvents(page);
    const group = page.getByTestId("chip-input-remove");
    const body = (name: string) =>
      group.getByRole("button", { name, exact: true });

    await group
      .getByRole("button", { name: "Remove Alex", exact: true })
      .click();
    await expect(chip(page, "remove", "Alex")).toHaveCount(0);
    await expect(body("Blake")).toBeFocused();

    await page.keyboard.press("Backspace");
    await expect(chip(page, "remove", "Blake")).toHaveCount(0);
    // Casey is disabled, so focus skips to Drew
    await expect(body("Drew")).toBeFocused();

    // Drew is the last enabled chip, so removing it leaves focus nowhere to go
    await page.keyboard.press("Tab");
    await expect(
      group.getByRole("button", { name: "Remove Drew", exact: true })
    ).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(chip(page, "remove", "Drew")).toHaveCount(0);

    // a disabled chip can't be removed
    await body("Casey").evaluate((el) =>
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Delete", bubbles: true })
      )
    );
    await expect(chip(page, "remove", "Casey")).toHaveCount(1);
    expect(await recorded(page)).toEqual([
      "remove:Alex",
      "remove:Blake",
      "remove:Drew",
    ]);
  });

  test("a page can keep a chip by canceling its remove", async ({ page }) => {
    await page.evaluate(() =>
      document.addEventListener("remove", (event) => event.preventDefault())
    );
    const target = chip(page, "remove", "Alex");
    await part(target, "remove").click();
    await expect(target).toHaveCount(1);
  });

  // M3's Guidelines: an input chip can support editing; in edit mode it reverts back to a text
  // string. Enter commits, firing `change` with the new text; Escape cancels.
  test("an editable chip turns into a text field on a tap, Enter committing and Escape canceling", async ({
    page,
  }) => {
    await recordEvents(page);
    const target = chip(page, "edit", "ziad@example.com");
    const body = part(target, "body");
    await expect(body).not.toHaveAttribute("aria-pressed");
    await body.click();
    const field = page
      .getByTestId("chip-input-edit")
      .getByRole("textbox", { name: "Edit ziad@example.com", exact: true });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("ziad@example.com");
    await expect(body).toBeHidden();
    await expect(part(target, "remove")).toBeHidden();

    await field.fill("ziad.aouad@example.com");
    await page.keyboard.press("Enter");
    const renamed = chip(page, "edit", "ziad.aouad@example.com");
    await expect(part(renamed, "body")).toBeFocused();
    await expect(
      page.getByTestId("chip-input-edit").getByRole("button", {
        name: "Remove ziad.aouad@example.com",
        exact: true,
      })
    ).toBeVisible();

    await page.keyboard.press("Enter");
    await part(renamed, "edit").fill("someone else");
    await page.keyboard.press("Escape");
    await expect(part(renamed, "body")).toBeFocused();
    await expect(part(renamed, "label")).toHaveText("ziad.aouad@example.com");
    expect(await recorded(page)).toEqual([
      "change:ziad@example.com>ziad.aouad@example.com",
    ]);
  });

  // `size` counts average characters, too few for an address's @ and m
  test("the edit field shows its whole text, as it opens and as it grows", async ({
    page,
  }) => {
    const target = chip(page, "edit", "ziad@example.com");
    await part(target, "body").click();
    const field = part(target, "edit");
    const clipped = () =>
      field.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(await clipped()).toBeLessThanOrEqual(0);
    await field.pressSequentially("mmmmmmmmmm@@@@@@@@@@WWWWWWWWWW");
    expect(await clipped()).toBeLessThanOrEqual(0);
  });

  test("a page can refuse an edit, keeping the field open, and an emptied chip is removed", async ({
    page,
  }) => {
    await page.evaluate(() =>
      document.addEventListener("change", (event) => {
        const { value } = (event as CustomEvent<{ value: string }>).detail;
        if (!value.includes("@")) event.preventDefault();
      })
    );
    const target = chip(page, "edit", "ping@example.com");
    await part(target, "body").click();
    const field = part(target, "edit");
    await field.fill("not an address");
    await page.keyboard.press("Enter");
    await expect(field).toBeVisible();
    await expect(part(target, "label")).toHaveText("ping@example.com");

    await field.fill("");
    await page.keyboard.press("Enter");
    await expect(target).toHaveCount(0);
    await expect(part(chip(page, "edit", "Fabian Reza"), "body")).toBeFocused();
  });

  // Like an <option>, a chip shows its label and stands for its value, the label when it has
  // none: an edit opens on the value, and the text committed is both, as for typed text
  test("an edit opens on the chip's value, and the committed text becomes its label and value", async ({
    page,
  }) => {
    // by place, as the edit renames it
    const target = page
      .getByTestId("chip-input-edit")
      .locator("[data-ac-chip-input]")
      .nth(2);
    const body = part(target, "body");
    await body.click();
    const field = part(target, "edit");
    await expect(field).toHaveValue("fabian@example.com");
    await field.fill("fabian.reza@example.com");
    await page.keyboard.press("Enter");
    await expect(part(target, "label")).toHaveText("fabian.reza@example.com");
    await expect(body).not.toHaveAttribute("value");
  });

  // M3's Guidelines show a contact's chip opening as "Name <address>": the page writes the text
  // an edit opens with on `edit`, and reads the label and value back from it on `change`
  test("a page can write the text an edit opens with, and split the committed text into label and value", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.addEventListener("edit", (event) => {
        const detail = (
          event as CustomEvent<{ text: string; value: string; label: string }>
        ).detail;
        if (detail.value !== detail.label)
          detail.text = `${detail.label} <${detail.value}>`;
      });
      document.addEventListener("change", (event) => {
        const detail = (event as CustomEvent<{ value: string; label: string }>)
          .detail;
        const match = detail.value.match(/^(.+?)\s*<(.+)>$/);
        if (match) [, detail.label, detail.value] = match;
      });
    });
    // by place, as the edit renames it
    const target = page
      .getByTestId("chip-input-edit")
      .locator("[data-ac-chip-input]")
      .nth(2);
    const body = part(target, "body");
    await body.click();
    const field = part(target, "edit");
    await expect(field).toHaveValue("Fabian Reza <fabian@example.com>");
    await field.fill("Fabian R. <fabian.reza@example.com>");
    await page.keyboard.press("Enter");
    await expect(part(target, "label")).toHaveText("Fabian R.");
    await expect(body).toHaveAttribute("value", "fabian.reza@example.com");

    // a plain chip edits as its text
    await part(chip(page, "edit", "ping@example.com"), "body").click();
    await expect(
      part(chip(page, "edit", "ping@example.com"), "edit")
    ).toHaveValue("ping@example.com");
  });

  test("a page can keep a chip from opening its edit", async ({ page }) => {
    await page.evaluate(() =>
      document.addEventListener("edit", (event) => event.preventDefault())
    );
    const target = chip(page, "edit", "Fabian Reza");
    await part(target, "body").click();
    await expect(part(target, "edit")).toBeHidden();
  });

  // ChipGroup's arrow keys stay out of the edit field, which keeps them for its text
  test("the arrow keys move between chips, but not out of the edit field", async ({
    page,
  }) => {
    const first = part(chip(page, "edit", "ziad@example.com"), "body");
    const second = part(chip(page, "edit", "ping@example.com"), "body");
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await expect(second).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowLeft");
    await expect(first).toBeFocused();

    await first.click();
    const field = part(chip(page, "edit", "ziad@example.com"), "edit");
    await page.keyboard.press("ArrowRight");
    await expect(field).toBeFocused();
  });

  // M3's Guidelines: an input chip can expand to show more information or options
  test("a chip with a popover opens it on a tap, expanded while it's open", async ({
    page,
  }) => {
    const target = chip(page, "popover", "Ziad Aouad");
    const body = part(target, "body");
    await expect(body).not.toHaveAttribute("aria-pressed");
    await expect(body).toHaveAttribute("aria-expanded", "false");
    await body.click();
    const popover = page.locator("#chip-input-contact");
    await expect(popover).toBeVisible();
    await expect(body).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => stateLayer(body, "opacity")).toBe("0.1");
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(body).toHaveAttribute("aria-expanded", "false");
  });

  // #252: M3's container transform, approximated over a popover. It opens over its chip, top
  // start corner to top start corner, or the corner it flips to, and its container grows out of
  // the chip's box while its content fades in after.
  test("its popover opens over the chip, from the chip's top start corner, and grows out of it", async ({
    page,
  }) => {
    await recordAnimations(page);
    const body = part(chip(page, "popover", "Ziad Aouad"), "body");
    await body.click();
    const popover = page.locator("#chip-input-contact");
    await expect(popover).toBeVisible();
    const chipBox = await box(body);
    const popoverBox = await box(popover);
    expect(Math.round(popoverBox.x)).toBe(Math.round(chipBox.x));
    expect(Math.round(popoverBox.y)).toBe(Math.round(chipBox.y));
    expect(popoverBox.width).toBeGreaterThan(chipBox.width);

    const grow = await clipFrom(page);
    expectInsets(grow.from, insetsOf(chipBox, popoverBox));
    expect(grow.from.radius).toBe(8);
    expectInsets(grow.to, [0, 0, 0, 0]);
    // M3's emphasized decelerate: fast, then slowing to a stop without overshooting, as the
    // chips Guidelines video shows
    const container = (await animations(page)).find((a) => a.clip);
    expect(container?.easing).toBe("cubic-bezier(0.05, 0.7, 0.1, 1)");
    const content = (await animations(page)).find(
      (animation) => animation.part === "content"
    );
    expect(content?.opacity).toEqual([0, 1]);
    expect(content?.delay).toBeGreaterThan(0);
  });

  test("near the window's bottom, its popover flips upward and grows from the chip's bottom", async ({
    page,
  }) => {
    await recordAnimations(page);
    const body = part(chip(page, "popover", "Ziad Aouad"), "body");
    await body.evaluate((el) => el.scrollIntoView({ block: "end" }));
    await body.click();
    const popover = page.locator("#chip-input-contact");
    await expect(popover).toBeVisible();
    const chipBox = await box(body);
    const popoverBox = await box(popover);
    expect(Math.round(popoverBox.x)).toBe(Math.round(chipBox.x));
    expect(Math.round(popoverBox.y + popoverBox.height)).toBe(
      Math.round(chipBox.y + chipBox.height)
    );
    expectInsets((await clipFrom(page)).from, insetsOf(chipBox, popoverBox));
  });

  test("right to left, its popover opens from the chip's top right corner", async ({
    page,
  }) => {
    await recordAnimations(page);
    const body = part(chip(page, "rtl", "سارة"), "body");
    await body.click();
    const popover = page.locator("#chip-input-contact-rtl");
    await expect(popover).toBeVisible();
    const chipBox = await box(body);
    const popoverBox = await box(popover);
    expect(Math.round(popoverBox.x + popoverBox.width)).toBe(
      Math.round(chipBox.x + chipBox.width)
    );
    expect(Math.round(popoverBox.y)).toBe(Math.round(chipBox.y));
    expectInsets((await clipFrom(page)).from, insetsOf(chipBox, popoverBox));
  });

  test("closing, its popover's content fades, then it shrinks back into the chip, which gets focus", async ({
    page,
  }) => {
    const body = part(chip(page, "popover", "Ziad Aouad"), "body");
    await body.click();
    const popover = page.locator("#chip-input-contact");
    await expect(popover).toBeVisible();
    const chipBox = await box(body);
    const popoverBox = await box(popover);
    await popover.getByRole("button", { name: "Close", exact: true }).focus();
    await recordAnimations(page);
    await page.keyboard.press("Enter");
    const shrink = await clipFrom(page);
    expectInsets(shrink.from, [0, 0, 0, 0]);
    expectInsets(shrink.to, insetsOf(chipBox, popoverBox));
    const recordedAnimations = await animations(page);
    const content = recordedAnimations.find((a) => a.part === "content");
    const container = recordedAnimations.find((a) => a.clip);
    expect(content?.opacity).toEqual([1, 0]);
    expect(container?.delay).toBeGreaterThanOrEqual(content?.duration ?? 0);
    // M3's emphasized accelerate, over 200ms, half the time it took to grow
    expect(container?.easing).toBe("cubic-bezier(0.3, 0, 0.8, 0.15)");
    expect(container?.duration).toBe(200);
    await expect(popover).toBeHidden();
    await expect(body).toBeFocused();
  });

  test("its popover, closed as soon as it opened, opens again as it should", async ({
    page,
  }) => {
    const body = part(chip(page, "popover", "Ziad Aouad"), "body");
    const popover = page.locator("#chip-input-contact");
    await body.evaluate((el) => {
      (el as HTMLElement).click();
      document.getElementById("chip-input-contact")?.hidePopover();
    });
    await expect(popover).toBeHidden();
    await expect
      .poll(() => popover.evaluate((el) => el.style.opacity))
      .toBe("");
    await body.click();
    await expect
      .poll(() => popover.evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");
  });

  // As other overlays, it doesn't move under reduced motion; the chips pages say nothing of it
  test("its popover, under reduced motion, opens and closes at once", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await recordAnimations(page);
    const body = part(chip(page, "popover", "Ziad Aouad"), "body");
    await body.click();
    const popover = page.locator("#chip-input-contact");
    await expect(popover).toBeVisible();
    expect(await popover.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1"
    );
    await popover.getByRole("button", { name: "Close", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(popover).toBeHidden();
    await expect(body).toBeFocused();
    expect(await recordedSoFar(page)).toEqual([]);
  });

  // A page's own showPopover() names the button it grows from as its source
  test("its popover, opened by script from the chip, opens over the chip and grows out of it", async ({
    page,
  }) => {
    await recordAnimations(page);
    const body = part(chip(page, "popover", "Ziad Aouad"), "body");
    const popover = page.locator("#chip-input-contact");
    await body.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await body.evaluate((el) =>
      (
        document.getElementById("chip-input-contact") as HTMLElement & {
          showPopover(options: { source: Element }): void;
        }
      ).showPopover({ source: el })
    );
    await expect(popover).toBeVisible();
    const chipBox = await box(body);
    const popoverBox = await box(popover);
    expect(Math.round(popoverBox.x)).toBe(Math.round(chipBox.x));
    expect(Math.round(popoverBox.y)).toBe(Math.round(chipBox.y));
    expectInsets((await clipFrom(page)).from, insetsOf(chipBox, popoverBox));
  });

  // Opened by the page's own showPopover(), with no button to grow from, it's centred and fades
  test("its popover, opened by script, is centred in the window", async ({
    page,
  }) => {
    const popover = page.locator("#chip-input-contact");
    await popover.evaluate((el) => (el as HTMLElement).showPopover());
    await expect(popover).toBeVisible();
    const { width, height } = page.viewportSize()!;
    const popoverBox = await box(popover);
    expect(Math.round(popoverBox.x + popoverBox.width / 2)).toBe(
      Math.round(width / 2)
    );
    expect(Math.round(popoverBox.y + popoverBox.height / 2)).toBe(
      Math.round(height / 2)
    );
  });

  // M3's Specs: the dragged state, level 4 with a 16% state layer, for a chip the page makes
  // draggable
  test("dragged, it rises to level 4", async ({ page }) => {
    const body = part(chip(page, "styles", "Ziad Aouad"), "body");
    await body.evaluate((el) => {
      el.setAttribute("draggable", "true");
      el.dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
    });
    await expect.poll(() => stateLayer(body, "opacity")).toBe("0.16");
  });

  test("right to left, the icon leads on the right and the remove button trails on the left", async ({
    page,
  }) => {
    const target = chip(page, "rtl", "زياد");
    // the label is short, so the chip's 88px minimum width adds to its end
    expect((await labelInsets(target))[0]).toBe(34);
    const outer = await box(target);
    const remove = await box(part(target, "remove").locator("svg"));
    expect(Math.round(remove.x - outer.x)).toBe(8);
  });
});
