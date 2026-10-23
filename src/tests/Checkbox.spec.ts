import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  expectFocusRing,
  resolvedColor,
  settled,
  textBox,
} from "./support/helpers";

// Each case on /tests/checkbox is a Section with data-testid="checkbox-<caseId>". Each checkbox
// is named by its label, which names the state it shows.
type CheckboxCaseId =
  | "states"
  | "error"
  | "disabled"
  | "no-label"
  | "form"
  | "rtl"
  | "on-secondary-container";

const checkbox = (page: Page, caseId: CheckboxCaseId, name: string) =>
  page
    .getByTestId(`checkbox-${caseId}`)
    .getByRole("checkbox", { name, exact: true });

// The <label> around the input
const label = (input: Locator) => input.locator("xpath=ancestor::label[1]");

// The parts M3's anatomy names (container, icon), plus the state layer and the 48px target
const part = (
  input: Locator,
  name: "target" | "state-layer" | "container" | "icon"
) => label(input).locator(`[data-ac-checkbox-part="${name}"]`);

// The mark's two strokes
const markLines = (input: Locator) => part(input, "icon").locator("line");

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

// The mark's two strokes: their rotation in degrees, read off the computed transform matrix
const legAngles = (input: Locator) =>
  markLines(input).evaluateAll((lines) =>
    lines.map((line) => {
      const { a, b } = new DOMMatrix(getComputedStyle(line).transform);
      return Math.round((Math.atan2(b, a) * 180) / Math.PI);
    })
  );

test.describe("Checkbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/checkbox");
  });

  test("is a native checkbox named by its label, in M3's three states", async ({
    page,
  }) => {
    const unselected = checkbox(page, "states", "Unselected");
    const selected = checkbox(page, "states", "Selected");
    const indeterminate = checkbox(page, "states", "Indeterminate");

    await expect(unselected).toHaveAttribute("type", "checkbox");
    await expect(unselected).not.toBeChecked();
    await expect(selected).toBeChecked();
    await expect(indeterminate).toBeChecked({ indeterminate: true });

    await expect(checkbox(page, "no-label", "Select row")).toBeVisible();
  });

  test("clicking the label, or pressing Space, toggles it", async ({
    page,
  }) => {
    const unselected = checkbox(page, "states", "Unselected");

    await page
      .getByTestId("checkbox-states")
      .getByText("Unselected", { exact: true })
      .click();
    await expect(unselected).toBeChecked();

    await unselected.focus();
    await page.keyboard.press("Space");
    await expect(unselected).not.toBeChecked();
  });

  test("an indeterminate checkbox becomes selected when chosen", async ({
    page,
  }) => {
    const indeterminate = checkbox(page, "states", "Indeterminate");

    await indeterminate.click();
    await expect(indeterminate).toBeChecked();
    await expect(indeterminate).not.toBeChecked({ indeterminate: true });
  });

  test("matches M3's measurements: 18px container, 40px state layer, 48px target", async ({
    page,
  }) => {
    const input = checkbox(page, "states", "Selected");
    const container = await box(part(input, "container"));
    const stateLayer = await box(part(input, "state-layer"));
    const target = await box(part(input, "target"));

    expect([container.width, container.height]).toEqual([18, 18]);
    expect([stateLayer.width, stateLayer.height]).toEqual([40, 40]);
    expect([target.width, target.height]).toEqual([48, 48]);
    // all three share a center
    for (const inner of [container, stateLayer]) {
      expect(inner.x + inner.width / 2).toBeCloseTo(
        target.x + target.width / 2
      );
      expect(inner.y + inner.height / 2).toBeCloseTo(
        target.y + target.height / 2
      );
    }

    await expect(part(input, "container")).toHaveCSS(
      "border-top-left-radius",
      "2px"
    );
    // rounded-full: a radius of at least half its size
    expect(
      parseFloat(
        await style(part(input, "state-layer"), "border-top-left-radius")
      )
    ).toBeGreaterThanOrEqual(20);
    await expect(
      part(checkbox(page, "states", "Unselected"), "container")
    ).toHaveCSS("border-top-width", "2px");
  });

  test("unselected has an on-surface-variant outline; selected and indeterminate fill with primary", async ({
    page,
  }) => {
    await settled(page);
    const unselected = part(
      checkbox(page, "states", "Unselected"),
      "container"
    );
    await expect(unselected).toHaveCSS(
      "border-top-color",
      await colorRole(page, "on-surface-variant")
    );
    await expect(unselected).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    for (const name of ["Selected", "Indeterminate"]) {
      const input = checkbox(page, "states", name);
      await expect(part(input, "container")).toHaveCSS(
        "background-color",
        await colorRole(page, "primary")
      );
      await expect(part(input, "container")).toHaveCSS(
        "border-top-color",
        await colorRole(page, "primary")
      );
      for (const line of await markLines(input).all()) {
        await expect(line).toHaveCSS(
          "stroke",
          await colorRole(page, "on-primary")
        );
      }
    }
  });

  test("the mark is a check when selected, a dash when indeterminate, and hidden when unselected", async ({
    page,
  }) => {
    await settled(page);
    const selected = checkbox(page, "states", "Selected");
    const indeterminate = checkbox(page, "states", "Indeterminate");
    const unselected = checkbox(page, "states", "Unselected");

    expect(await legAngles(selected)).toEqual([45, -45]);
    expect(await legAngles(indeterminate)).toEqual([0, 0]);
    await expect(part(selected, "icon")).toHaveCSS("clip-path", "inset(0px)");
    await expect(part(unselected, "icon")).toHaveCSS(
      "clip-path",
      "inset(0px 100% 0px 0px)"
    );

    // the check morphs into the dash and back
    await selected.evaluate(
      (el: HTMLInputElement) => (el.indeterminate = true)
    );
    await settled(page);
    expect(await legAngles(selected)).toEqual([0, 0]);
    await selected.evaluate(
      (el: HTMLInputElement) => (el.indeterminate = false)
    );
    await settled(page);
    expect(await legAngles(selected)).toEqual([45, -45]);
  });

  test("error is announced with aria-invalid and uses M3's error roles", async ({
    page,
  }) => {
    await settled(page);
    const unselected = checkbox(page, "error", "Unselected");
    await expect(unselected).toHaveAttribute("aria-invalid", "true");
    await expect(unselected).toHaveAccessibleDescription(
      "Choose at least one option"
    );
    await expect(part(unselected, "container")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "error")
    );

    for (const name of ["Selected", "Indeterminate"]) {
      const input = checkbox(page, "error", name);
      await expect(part(input, "container")).toHaveCSS(
        "background-color",
        await colorRole(page, "error")
      );
      for (const line of await markLines(input).all()) {
        await expect(line).toHaveCSS(
          "stroke",
          await colorRole(page, "on-error")
        );
      }
    }

    // hovered, the state layer is error too
    await unselected.hover();
    await expect(part(unselected, "state-layer")).toHaveCSS(
      "background-color",
      await colorRole(page, "error")
    );
  });

  test("disabled uses on-surface at 38%, with a surface mark, and can't be toggled", async ({
    page,
  }) => {
    await settled(page);
    const unselected = checkbox(page, "disabled", "Unselected");
    await expect(unselected).toBeDisabled();
    await expect(part(unselected, "container")).toHaveCSS(
      "border-top-color",
      await disabledRole(page, "on-surface")
    );
    await expect(label(unselected)).toHaveCSS(
      "color",
      await disabledRole(page, "on-surface")
    );

    for (const name of ["Selected", "Indeterminate"]) {
      const input = checkbox(page, "disabled", name);
      await expect(part(input, "container")).toHaveCSS(
        "background-color",
        await disabledRole(page, "on-surface")
      );
      for (const line of await markLines(input).all()) {
        await expect(line).toHaveCSS(
          "stroke",
          await colorRole(page, "surface")
        );
      }
    }

    await page
      .getByTestId("checkbox-disabled")
      .getByText("Unselected", { exact: true })
      .click({ force: true });
    await expect(unselected).not.toBeChecked();
    await expect(part(unselected, "state-layer")).toHaveCSS("opacity", "0");
  });

  test("state layer: on-surface or primary at 8% on hover, 10% on focus with a focus ring", async ({
    page,
  }) => {
    const unselected = checkbox(page, "states", "Unselected");
    const selected = checkbox(page, "states", "Selected");

    await expect(part(unselected, "state-layer")).toHaveCSS("opacity", "0");

    await unselected.hover();
    await expect(part(unselected, "state-layer")).toHaveCSS("opacity", "0.08");
    await expect(part(unselected, "state-layer")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-surface")
    );
    // hovered, the outline darkens to on-surface
    await expect(part(unselected, "container")).toHaveCSS(
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
    await selected.focus();
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

  // One press per test: in Firefox, after a press on a label, the next press elsewhere doesn't
  // match :active until the focused checkbox is blurred
  const pressedColors = { Unselected: "primary", Selected: "on-surface" };
  for (const [name, color] of Object.entries(pressedColors)) {
    test(`pressed, the state layer takes the color of the state it's moving to: ${name} is ${color}`, async ({
      page,
    }) => {
      const input = checkbox(page, "states", name);

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

  test("works in a native form: checked values submit, reset restores them, required validates", async ({
    page,
  }) => {
    const form = page.getByTestId("checkbox-form").locator("form");
    const toppings = () =>
      form.evaluate((el: HTMLFormElement) =>
        new FormData(el).getAll("toppings")
      );

    expect(await toppings()).toEqual(["cheese", "onion"]);
    await checkbox(page, "form", "Tomato").check();
    await checkbox(page, "form", "Cheese").uncheck();
    expect(await toppings()).toEqual(["tomato", "onion"]);

    await form.getByRole("button", { name: "Reset" }).click();
    expect(await toppings()).toEqual(["cheese", "onion"]);

    // submitting with the required box unchecked marks it invalid, in the error colors
    const terms = checkbox(page, "form", "I accept the terms");
    await form.getByRole("button", { name: "Submit" }).click();
    await expect(terms).toBeFocused();
    await page.mouse.move(0, 0);
    await expect(part(terms, "container")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "error")
    );
    await terms.check();
    await expect(part(terms, "container")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary")
    );
  });

  test("mirrors right to left: the label sits on the checkbox's left", async ({
    page,
  }) => {
    const input = checkbox(page, "rtl", "Selected");
    const target = await box(part(input, "target"));
    const text = await textBox(label(input));

    expect(text.x + text.width).toBeLessThanOrEqual(target.x + 0.5);
  });

  test("on a colored background, the outline and label follow the background's on-color", async ({
    page,
  }) => {
    await settled(page);
    const input = checkbox(page, "on-secondary-container", "Unselected");
    await expect(part(input, "container")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "on-secondary-container")
    );
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing transitions", async ({ page }) => {
      const input = checkbox(page, "states", "Selected");
      for (const name of ["state-layer", "container", "icon"] as const) {
        expect(await style(part(input, name), "transition-duration")).toMatch(
          /^0s(, 0s)*$/
        );
      }
      for (const line of await markLines(input).all()) {
        expect(await style(line, "transition-duration")).toMatch(/^0s(, 0s)*$/);
      }
    });
  });
});
