import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  expectFocusRing,
  resolvedColor,
  settled,
  textBox,
} from "./support/helpers";

// Each case on /tests/radio-button is a Section with data-testid="radio-button-<caseId>". Each
// radio button is named by its label.
type RadioButtonCaseId =
  | "states"
  | "none-selected"
  | "disabled"
  | "no-label"
  | "form"
  | "rtl"
  | "on-secondary-container";

const section = (page: Page, caseId: RadioButtonCaseId) =>
  page.getByTestId(`radio-button-${caseId}`);

const radio = (page: Page, caseId: RadioButtonCaseId, name: string) =>
  section(page, caseId).getByRole("radio", { name, exact: true });

// The <label> around the input
const label = (input: Locator) => input.locator("xpath=ancestor::label[1]");

// The parts M3's anatomy names (icon), plus its dot, the state layer and the 48px target
const part = (
  input: Locator,
  name: "target" | "state-layer" | "icon" | "dot"
) => label(input).locator(`[data-ac-radio-button-part="${name}"]`);

const style = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );

const colorRole = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

const disabledRole = (page: Page, name: string) =>
  resolvedColor(
    page,
    `color-mix(in oklab, var(--theme-color-${name}) 38%, transparent)`
  );

test.describe("RadioButton", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/radio-button");
  });

  test("is a native radio named by its label, in a group named by its legend", async ({
    page,
  }) => {
    const group = section(page, "states").getByRole("group", {
      name: "Ringtone",
    });
    await expect(group.getByRole("radio")).toHaveCount(3);
    await expect(radio(page, "states", "Beacon")).toHaveAttribute(
      "type",
      "radio"
    );
    await expect(radio(page, "states", "Beacon")).not.toBeChecked();
    await expect(radio(page, "states", "Chimes")).toBeChecked();

    await expect(
      section(page, "none-selected").getByRole("radiogroup", {
        name: "Sort by",
      })
    ).toBeVisible();
    await expect(radio(page, "no-label", "Choose row 1")).toBeVisible();
  });

  test("clicking the label selects it and clears the rest of its group", async ({
    page,
  }) => {
    await section(page, "states").getByText("Circuit", { exact: true }).click();
    await expect(radio(page, "states", "Circuit")).toBeChecked();
    await expect(radio(page, "states", "Chimes")).not.toBeChecked();

    // choosing a selected one again keeps it selected
    await radio(page, "states", "Circuit").click();
    await expect(radio(page, "states", "Circuit")).toBeChecked();
  });

  test("Tab enters the group at the selected radio; arrows move the selection and wrap", async ({
    page,
    browserName,
  }) => {
    const chimes = radio(page, "states", "Chimes");
    await radio(page, "states", "Beacon").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(chimes).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(radio(page, "states", "Circuit")).toBeFocused();
    await expect(radio(page, "states", "Circuit")).toBeChecked();

    // The arrow keys are the browser's own, and Playwright's WebKit stops at the ends of the
    // group instead of wrapping
    if (browserName !== "webkit") {
      await page.keyboard.press("ArrowDown");
      await expect(radio(page, "states", "Beacon")).toBeFocused();
      await expect(radio(page, "states", "Beacon")).toBeChecked();
      await page.keyboard.press("ArrowUp");
      await expect(radio(page, "states", "Circuit")).toBeChecked();
    }

    await page.keyboard.press("ArrowUp");
    await expect(chimes).toBeFocused();
    await expect(chimes).toBeChecked();
  });

  test("with none selected, Tab focuses the first and Space selects it", async ({
    page,
  }) => {
    await section(page, "none-selected")
      .getByRole("button", { name: "Before" })
      .focus();
    await page.keyboard.press("Tab");
    const relevance = radio(page, "none-selected", "Relevance");
    await expect(relevance).toBeFocused();
    await expect(relevance).not.toBeChecked();

    await page.keyboard.press("Space");
    await expect(relevance).toBeChecked();
  });

  // On a fresh page: Chromium returns to whichever radio last had focus
  test("with none selected, Shift+Tab focuses the last", async ({
    page,
    browserName,
  }) => {
    await section(page, "none-selected")
      .getByRole("button", { name: "After" })
      .focus();
    await page.keyboard.press("Shift+Tab");
    // Firefox focuses the first, as it does for Tab
    const name = browserName === "firefox" ? "Relevance" : "Price";
    await expect(radio(page, "none-selected", name)).toBeFocused();
  });

  test("matches M3's measurements: 20px icon, 10px dot, 40px state layer, 48px target", async ({
    page,
  }) => {
    await settled(page);
    const input = radio(page, "states", "Chimes");
    const icon = await box(part(input, "icon"));
    const dot = await box(part(input, "dot"));
    const stateLayer = await box(part(input, "state-layer"));
    const target = await box(part(input, "target"));

    expect([icon.width, icon.height]).toEqual([20, 20]);
    expect([dot.width, dot.height]).toEqual([10, 10]);
    expect([stateLayer.width, stateLayer.height]).toEqual([40, 40]);
    expect([target.width, target.height]).toEqual([48, 48]);
    // all four share a center
    for (const inner of [icon, dot, stateLayer]) {
      expect(inner.x + inner.width / 2).toBeCloseTo(
        target.x + target.width / 2
      );
      expect(inner.y + inner.height / 2).toBeCloseTo(
        target.y + target.height / 2
      );
    }

    await expect(part(input, "icon")).toHaveCSS("border-top-width", "2px");
    // rounded-full: a radius of at least half its size
    for (const name of ["icon", "dot", "state-layer"] as const) {
      expect(
        parseFloat(await style(part(input, name), "border-top-left-radius"))
      ).toBeGreaterThanOrEqual(5);
    }
  });

  test("unselected is an on-surface-variant ring; selected is a primary ring and dot", async ({
    page,
  }) => {
    await settled(page);
    const unselected = radio(page, "states", "Beacon");
    await expect(part(unselected, "icon")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "on-surface-variant")
    );
    await expect(part(unselected, "dot")).toHaveCSS(
      "transform",
      "matrix(0, 0, 0, 0, 0, 0)"
    );

    const selected = radio(page, "states", "Chimes");
    await expect(part(selected, "icon")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "primary")
    );
    await expect(part(selected, "dot")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary")
    );
    await expect(part(selected, "dot")).toHaveCSS("transform", "none");

    // the label stays on-surface, selected or not
    await expect(label(unselected)).toHaveCSS(
      "color",
      await colorRole(page, "on-surface")
    );
    await expect(label(selected)).toHaveCSS(
      "color",
      await colorRole(page, "on-surface")
    );
  });

  test("disabled uses on-surface at 38% and can't be selected", async ({
    page,
  }) => {
    await settled(page);
    const unselected = radio(page, "disabled", "Unselected");
    const selected = radio(page, "disabled", "Selected");
    await expect(unselected).toBeDisabled();

    await expect(part(unselected, "icon")).toHaveCSS(
      "border-top-color",
      await disabledRole(page, "on-surface")
    );
    await expect(part(selected, "icon")).toHaveCSS(
      "border-top-color",
      await disabledRole(page, "on-surface")
    );
    await expect(part(selected, "dot")).toHaveCSS(
      "background-color",
      await disabledRole(page, "on-surface")
    );
    await expect(label(unselected)).toHaveCSS(
      "color",
      await disabledRole(page, "on-surface")
    );

    await section(page, "disabled")
      .getByText("Unselected", { exact: true })
      .click({ force: true });
    await expect(unselected).not.toBeChecked();
    await expect(part(unselected, "state-layer")).toHaveCSS("opacity", "0");
  });

  test("state layer: on-surface or primary at 8% on hover, 10% on focus with a focus ring", async ({
    page,
  }) => {
    const unselected = radio(page, "states", "Beacon");
    const selected = radio(page, "states", "Chimes");

    await expect(part(unselected, "state-layer")).toHaveCSS("opacity", "0");

    await unselected.hover();
    await expect(part(unselected, "state-layer")).toHaveCSS("opacity", "0.08");
    await expect(part(unselected, "state-layer")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-surface")
    );
    // hovered, the ring darkens to on-surface
    await expect(part(unselected, "icon")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "on-surface")
    );

    await selected.hover();
    await expect(part(selected, "state-layer")).toHaveCSS("opacity", "0.08");
    await expect(part(selected, "state-layer")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary")
    );

    await page.mouse.move(0, 0);
    await unselected.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(selected).toBeFocused();
    await expect(part(selected, "state-layer")).toHaveCSS("opacity", "0.1");
    await expectFocusRing(selected);

    // focused and hovered, focus's 10% wins
    await selected.hover();
    await settled(page);
    expect(await style(part(selected, "state-layer"), "opacity")).toBe("0.1");
  });

  // One press per test, as in Checkbox.spec.ts: in Firefox, after a press on a label, the next
  // press elsewhere doesn't match :active until the focused input is blurred
  const pressedColors = { Beacon: "primary", Chimes: "on-surface" };
  for (const [name, color] of Object.entries(pressedColors)) {
    test(`pressed, the state layer takes the color of the state it's moving to: ${name} is ${color}`, async ({
      page,
    }) => {
      const input = radio(page, "states", name);

      await input.hover();
      await page.mouse.down();
      await expect(part(input, "state-layer")).toHaveCSS("opacity", "0.1");
      await expect(part(input, "state-layer")).toHaveCSS(
        "background-color",
        await colorRole(page, color)
      );
      await page.mouse.up();
    });
  }

  test("works in a native form: the chosen value submits, reset restores it, required validates", async ({
    page,
  }) => {
    const form = section(page, "form").locator("form");
    const value = (name: string) =>
      form.evaluate((el: HTMLFormElement, n) => new FormData(el).get(n), name);

    expect(await value("delivery")).toBe("standard");
    await radio(page, "form", "Express").check();
    expect(await value("delivery")).toBe("express");

    await form.getByRole("button", { name: "Reset" }).click();
    expect(await value("delivery")).toBe("standard");

    // a required group with nothing chosen stops the submit
    await form.getByRole("button", { name: "Submit" }).click();
    await expect(radio(page, "form", "Card")).toBeFocused();
    expect(
      await form.evaluate((el: HTMLFormElement) => el.checkValidity())
    ).toBe(false);
    await radio(page, "form", "Invoice").check();
    expect(
      await form.evaluate((el: HTMLFormElement) => el.checkValidity())
    ).toBe(true);
  });

  test("mirrors right to left: the label sits on the radio's left", async ({
    page,
  }) => {
    const input = radio(page, "rtl", "Selected");
    const target = await box(part(input, "target"));
    const text = await textBox(label(input));

    expect(text.x + text.width).toBeLessThanOrEqual(target.x + 0.5);
  });

  test("on a colored background, the ring and label follow the background's on-color", async ({
    page,
  }) => {
    await settled(page);
    const input = radio(page, "on-secondary-container", "Unselected");
    await expect(part(input, "icon")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "on-secondary-container")
    );
    await expect(label(input)).toHaveCSS(
      "color",
      await colorRole(page, "on-secondary-container")
    );
  });

  // Compose's timing: the dot on fast spatial, the ring's and dot's colors on default effects
  test("the dot grows on fast spatial; the colors change on default effects", async ({
    page,
  }) => {
    const input = radio(page, "states", "Chimes");
    const duration = async (target: Locator, property: string) => {
      const properties = (await style(target, "transition-property")).split(
        ", "
      );
      const durations = (await style(target, "transition-duration")).split(
        ", "
      );
      return parseFloat(durations[properties.indexOf(property)]) * 1000;
    };
    const token = async (name: string) =>
      parseFloat(
        await style(page.locator("html"), `--theme-duration-spring-${name}`)
      );

    expect(await duration(part(input, "dot"), "transform")).toBe(
      await token("fast-spatial")
    );
    expect(await duration(part(input, "dot"), "background-color")).toBe(
      await token("default-effects")
    );
    expect(await duration(part(input, "icon"), "border-color")).toBe(
      await token("default-effects")
    );
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing transitions", async ({ page }) => {
      const input = radio(page, "states", "Chimes");
      for (const name of ["state-layer", "icon", "dot"] as const) {
        expect(await style(part(input, name), "transition-duration")).toMatch(
          /^0s(, 0s)*$/
        );
      }
    });
  });
});
