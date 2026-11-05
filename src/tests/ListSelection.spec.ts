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

// Each case on /tests/list is a Section with data-testid="list-<caseId>". A selection item is a
// <label> holding a native checkbox, radio or switch: found by its control's role and name.
type SelectionCaseId =
  "checkbox" | "checkbox-trailing" | "radio" | "switch" | "selection-rtl";
type ControlRole = "checkbox" | "radio" | "switch";

const scope = (page: Page, caseId: SelectionCaseId) =>
  page.getByTestId(`list-${caseId}`);
const control = (
  page: Page,
  caseId: SelectionCaseId,
  role: ControlRole,
  name: string
) => scope(page, caseId).getByRole(role, { name: new RegExp(`^${name}`) });
// the item's container: the <li>'s <label>
const itemOf = (target: Locator) =>
  target.locator("xpath=ancestor::label[@data-ac-list-item]");
const part = (target: Locator, name: string) =>
  target.locator(`[data-ac-list-item-part=${name}]`);
const stateLayerOpacity = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el, "::before").opacity);
const radius = (target: Locator) => css(target, "border-top-left-radius");

test.describe("List selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/list");
  });

  // M3's Accessibility page: an item is named by its label and supporting text; ADR-0028 makes
  // the control a native input, announced with its own role
  test("each item is a native checkbox, radio or switch, named by its label and supporting text", async ({
    page,
  }) => {
    const bread = scope(page, "checkbox").getByRole("checkbox", {
      name: "Bread Sourdough or wheat",
    });
    await expect(bread).toBeChecked();
    await expect(bread).toHaveJSProperty("tagName", "INPUT");
    await expect(itemOf(bread)).toHaveJSProperty("tagName", "LABEL");
    // the overline and trailing text describe it
    await expect(
      scope(page, "checkbox").getByRole("checkbox", { name: "Rice" })
    ).toHaveAccessibleDescription("Gluten free");
    await expect(
      scope(page, "radio").getByRole("radio", { name: "Large" })
    ).toHaveAccessibleDescription("+$2");
    await expect(
      scope(page, "radio").getByRole("radio", { name: "Medium" })
    ).toBeChecked();
    await expect(
      scope(page, "switch").getByRole("switch", {
        name: "Notifications Sounds and badges",
      })
    ).toBeChecked();
    // still a list of list items
    await expect(
      scope(page, "checkbox")
        .getByRole("list", { name: "Choose your sides" })
        .getByRole("listitem")
    ).toHaveCount(5);
  });

  // M3's Guidelines: the whole item is the control's target
  test("a click anywhere on the item toggles its control", async ({ page }) => {
    const pita = control(page, "checkbox", "checkbox", "Pita");
    await part(itemOf(pita), "label").click();
    await expect(pita).toBeChecked();
    await itemOf(pita).click({ position: { x: 300, y: 20 } });
    await expect(pita).not.toBeChecked();

    const large = control(page, "radio", "radio", "Large");
    await part(itemOf(large), "trailing").click();
    await expect(large).toBeChecked();
    await expect(control(page, "radio", "radio", "Medium")).not.toBeChecked();

    const airplane = control(page, "switch", "switch", "Airplane mode");
    await part(itemOf(airplane), "leading").click();
    await expect(airplane).toBeChecked();
  });

  test("submits with its form", async ({ page }) => {
    await part(
      itemOf(control(page, "checkbox", "checkbox", "Pita")),
      "label"
    ).click();
    const values = (id: string, name: string) =>
      page.evaluate(
        ([id, name]) =>
          new FormData(document.getElementById(id) as HTMLFormElement).getAll(
            name
          ),
        [id, name]
      );
    // the disabled selected item doesn't submit, as a disabled input doesn't
    expect(await values("sides", "side")).toEqual(["bread", "pita"]);
    expect(await values("sizes", "size")).toEqual(["m"]);
  });

  // Compose draws a list item's control at its own size, with no target or ripple of its own:
  // 24px for a checkbox or radio button, 52 by 32px for a switch
  test("the control sits at the leading or trailing end, at its own size, with no state layer of its own", async ({
    page,
  }) => {
    for (const [caseId, role, name, position, width, height] of [
      ["checkbox", "checkbox", "Bread", "leading", 24, 24],
      ["checkbox-trailing", "checkbox", "Ali Connors", "trailing", 24, 24],
      ["radio", "radio", "Small", "leading", 24, 24],
      ["switch", "switch", "Airplane mode", "trailing", 52, 32],
    ] as const) {
      const target = itemOf(control(page, caseId, role, name));
      const slot = part(target, position);
      const size = await box(slot);
      expect([Math.round(size.width), Math.round(size.height)]).toEqual([
        width,
        height,
      ]);
      await expect(slot.locator("input")).toHaveCount(1);
      await expect(
        target.locator(
          "[data-ac-checkbox-part=state-layer], [data-ac-radio-button-part=state-layer], [data-ac-switch-part=state-layer]"
        )
      ).toHaveCount(0);
      const container = await box(target);
      const edge =
        position === "leading"
          ? size.x - container.x
          : container.x + container.width - (size.x + size.width);
      expect(Math.round(edge)).toBe(16);
    }
    // a trailing control leaves the leading slot to an avatar
    await expect(
      part(
        itemOf(control(page, "checkbox-trailing", "checkbox", "Ali Connors")),
        "leading"
      )
    ).toHaveText("A");
  });

  // M3 Expressive's highlighted selection: secondary-container, with on-secondary-container
  // content and 16px corners all round
  test("a selected item is highlighted, in light and dark", async ({
    page,
  }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await settled(page);
      const onContainer = await resolvedColor(
        page,
        "var(--theme-color-on-secondary-container)"
      );
      const bread = itemOf(control(page, "checkbox", "checkbox", "Bread"));
      await expect(bread).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-secondary-container)")
      );
      for (const name of ["label", "supporting"])
        await expect(part(bread, name)).toHaveCSS("color", onContainer);
      expect(await radius(bread)).toBe("16px");

      const pita = itemOf(control(page, "checkbox", "checkbox", "Pita"));
      await expect(pita).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-surface)")
      );
      await expect(part(pita, "label")).toHaveCSS(
        "color",
        await resolvedColor(page, "var(--theme-color-on-surface)")
      );
      expect(await radius(pita)).toBe("4px");

      const notifications = itemOf(
        control(page, "switch", "switch", "Notifications")
      );
      await expect(notifications).toHaveCSS(
        "background-color",
        await resolvedColor(page, "var(--theme-color-secondary-container)")
      );
      await expect(part(notifications, "leading")).toHaveCSS(
        "color",
        onContainer
      );
    }
  });

  test("toggling the control highlights the item, and clears it", async ({
    page,
  }) => {
    const pita = control(page, "checkbox", "checkbox", "Pita");
    const container = await resolvedColor(
      page,
      "var(--theme-color-secondary-container)"
    );
    await pita.check();
    await expect(itemOf(pita)).toHaveCSS("background-color", container);
    await pita.uncheck();
    await expect(itemOf(pita)).not.toHaveCSS("background-color", container);

    // choosing a radio moves the highlight
    await control(page, "radio", "radio", "Small").check();
    await expect(itemOf(control(page, "radio", "radio", "Small"))).toHaveCSS(
      "background-color",
      container
    );
    await expect(
      itemOf(control(page, "radio", "radio", "Medium"))
    ).not.toHaveCSS("background-color", container);
  });

  // M3's Specs: the on-surface state layer at 8% hovered and 10% pressed or focused; corners
  // 12px hovered and 16px pressed or focused, and 16px in every state once selected
  test("an item shows M3's state layer and corners hovered, pressed and focused", async ({
    page,
  }) => {
    // Tab focuses the checkbox; the item shows the focus
    const bread = itemOf(control(page, "checkbox", "checkbox", "Bread"));
    await page.getByRole("heading", { name: /^Checkboxes: multi/ }).click();
    await page.keyboard.press("Tab");
    await expect(control(page, "checkbox", "checkbox", "Bread")).toBeFocused();
    await expect.poll(() => stateLayerOpacity(bread)).toBe("0.1");
    await expectFocusRing(bread, { inset: true });
    expect(await css(bread, "box-shadow")).toContain(
      `${await resolvedColor(page, "var(--theme-color-secondary)")} 0px 0px 0px 3px inset`
    );
    await page.getByRole("heading", { name: /^Checkboxes: multi/ }).click();

    const pita = itemOf(control(page, "checkbox", "checkbox", "Pita"));
    await expect.poll(() => stateLayerOpacity(pita)).toBe("0");
    expect(await radius(pita)).toBe("4px");
    await pita.hover();
    await expect.poll(() => stateLayerOpacity(pita)).toBe("0.08");
    await expect.poll(() => radius(pita)).toBe("12px");
    await page.mouse.down();
    await expect.poll(() => stateLayerOpacity(pita)).toBe("0.1");
    await expect.poll(() => radius(pita)).toBe("16px");
    await page.mouse.up();
    await page.mouse.move(0, 0);

    // selected, its corners stay 16px hovered
    await bread.hover();
    await expect.poll(() => stateLayerOpacity(bread)).toBe("0.08");
    expect(await radius(bread)).toBe("16px");
  });

  // M3's Specs: disabled content on-surface at 38%; selected and disabled, the container is
  // on-surface at 10%
  test("a disabled item can't be toggled, its content on-surface at 38%", async ({
    page,
  }) => {
    const fries = control(page, "checkbox", "checkbox", "Fries");
    await expect(fries).toBeDisabled();
    const item = itemOf(fries);
    await item.click({ force: true });
    await expect(fries).not.toBeChecked();
    await expect
      .poll(async () => alpha(await css(part(item, "label"), "color")))
      .toBeCloseTo(0.38, 2);
    await item.hover();
    expect(await stateLayerOpacity(item)).toBe("0");
    expect(await radius(item)).toBe("4px");
    await expect(item).toHaveCSS("cursor", "default");

    const salad = itemOf(control(page, "checkbox", "checkbox", "Salad"));
    await expect(salad).toHaveCSS(
      "background-color",
      await resolvedColor(
        page,
        "color-mix(in oklab, var(--theme-color-on-surface) 10%, transparent)"
      )
    );
    await expect
      .poll(async () => alpha(await css(part(salad, "label"), "color")))
      .toBeCloseTo(0.38, 2);
  });

  // M3's Accessibility page: one Tab stop, the arrow keys move between items, wrapping, and
  // Space or Enter selects
  test("checkbox items are one Tab stop, moved through with the arrow keys and toggled with Space or Enter", async ({
    page,
  }) => {
    const bread = control(page, "checkbox", "checkbox", "Bread");
    const pita = control(page, "checkbox", "checkbox", "Pita");
    const rice = control(page, "checkbox", "checkbox", "Rice");

    await page.getByRole("heading", { name: /^Checkboxes: multi/ }).click();
    await page.keyboard.press("Tab");
    await expect(bread).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(pita).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(rice).toBeFocused();
    // past the disabled items, back to the first
    await page.keyboard.press("ArrowDown");
    await expect(bread).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(rice).toBeFocused();

    await page.keyboard.press("Space");
    await expect(rice).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(rice).not.toBeChecked();

    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "After the checkboxes" })
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(rice).toBeFocused();
  });

  // ADR-0028: radios keep the browser's keyboard, as ADR-0022 has it: Tab lands on the checked
  // one, and the arrow keys move the selection
  test("radio items keep the native radio keyboard", async ({ page }) => {
    await page.getByRole("heading", { name: /^Radio buttons/ }).click();
    await page.keyboard.press("Tab");
    const medium = control(page, "radio", "radio", "Medium");
    await expect(medium).toBeFocused();
    await page.keyboard.press("ArrowDown");
    const large = control(page, "radio", "radio", "Large");
    await expect(large).toBeFocused();
    await expect(large).toBeChecked();
    await expect(itemOf(large)).toHaveCSS(
      "background-color",
      await resolvedColor(page, "var(--theme-color-secondary-container)")
    );
  });

  test("Enter toggles a switch item once", async ({ page }) => {
    const airplane = control(page, "switch", "switch", "Airplane mode");
    await airplane.focus();
    await page.keyboard.press("Enter");
    await expect(airplane).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(airplane).not.toBeChecked();
  });

  test("mirrors right to left", async ({ page }) => {
    const bread = itemOf(control(page, "selection-rtl", "checkbox", "خبز"));
    const container = await box(bread);
    const leading = await box(part(bread, "leading"));
    expect(
      Math.round(container.x + container.width - (leading.x + leading.width))
    ).toBe(16);
    const notifications = itemOf(
      control(page, "selection-rtl", "switch", "الإشعارات")
    );
    const trailing = await box(part(notifications, "trailing"));
    expect(Math.round(trailing.x - (await box(notifications)).x)).toBe(16);
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("an item's highlight, corners and state layer change at once", async ({
      page,
    }) => {
      const pita = itemOf(control(page, "checkbox", "checkbox", "Pita"));
      await expect(pita).toHaveCSS("transition-duration", "0s");
      expect(
        await pita.evaluate(
          (el) => getComputedStyle(el, "::before").transitionDuration
        )
      ).toBe("0s");
    });
  });
});
