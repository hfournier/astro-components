import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor, settled, textBox } from "./support/helpers";

// Each case on /tests/text-field is a Section with data-testid="text-field-<caseId>". Each field
// is named by its label, which names the variant or state it shows.
type TextFieldCaseId =
  | "filled"
  | "outlined"
  | "supporting-text"
  | "error"
  | "icons"
  | "prefix-suffix"
  | "disabled"
  | "no-label"
  | "form"
  | "rtl"
  | "on-secondary-container";

// The icons case's fields are type="search" (searchbox), and a number field is a spinbutton
const field = (
  page: Page,
  caseId: TextFieldCaseId,
  name: string,
  role: "textbox" | "searchbox" | "spinbutton" = caseId === "icons"
    ? "searchbox"
    : "textbox"
) =>
  page
    .getByTestId(`text-field-${caseId}`)
    .getByRole(role, { name, exact: true });

// The element around the whole field, container and supporting text
const root = (input: Locator) =>
  input.locator("xpath=ancestor::*[@data-ac-text-field][1]");

// The parts M3's anatomy names, plus the filled field's state layer
const part = (
  input: Locator,
  name:
    | "container"
    | "state-layer"
    | "active-indicator"
    | "outline"
    | "label"
    | "leading-icon"
    | "trailing-icon"
    | "prefix"
    | "suffix"
    | "supporting-text"
) => root(input).locator(`[data-ac-text-field-part="${name}"]`);

const style = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );

const colorRole = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

const mixedRole = (page: Page, name: string, percent: number) =>
  resolvedColor(
    page,
    `color-mix(in oklab, var(--theme-color-${name}) ${percent}%, transparent)`
  );

// Focuses from the keyboard, with the pointer out of the way
const focusByKeyboard = async (page: Page, input: Locator) => {
  await page.mouse.move(0, 0);
  await input.focus();
  await settled(page);
};

// Where the label's text starts, and its line box, relative to the container
const labelOffset = async (input: Locator) => {
  const container = await box(part(input, "container"));
  const text = await textBox(part(input, "label"));
  const line = await box(part(input, "label"));
  return {
    start: text.x - container.x,
    top: line.y - container.y,
    height: line.height,
  };
};

test.describe("TextField", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/text-field");
  });

  test("is a native text input named by its label", async ({ page }) => {
    for (const caseId of ["filled", "outlined"] as const) {
      const input = field(page, caseId, "Empty");
      await expect(input).toHaveAttribute("type", "text");
      await expect(input).toHaveValue("");
      await expect(field(page, caseId, "Populated")).toHaveValue("Paris");
    }
    await expect(field(page, "no-label", "Search filled")).toBeVisible();
    await expect(field(page, "no-label", "Search outlined")).toBeVisible();
  });

  test("a required field's label ends with an asterisk, which its name includes", async ({
    page,
  }) => {
    const input = field(page, "form", "Username*");
    await expect(input).toHaveAttribute("required", "");
    await expect(part(input, "label")).toHaveText("Username*");
  });

  test("matches M3's measurements: 56px tall, 16px padding, Body Large input", async ({
    page,
  }) => {
    for (const caseId of ["filled", "outlined"] as const) {
      const input = field(page, caseId, "Populated");
      const container = await box(part(input, "container"));
      const text = await box(input);
      expect(container.height).toBeCloseTo(56, 1);
      expect(text.height).toBeCloseTo(24, 1);
      expect(text.x - container.x).toBeCloseTo(16, 1);
      await expect(input).toHaveCSS("font-size", "16px");
      await expect(input).toHaveCSS("line-height", "24px");
    }

    // filled: rounded top corners, square bottom ones; outlined: rounded all round
    const filled = part(field(page, "filled", "Empty"), "container");
    await expect(filled).toHaveCSS("border-top-left-radius", "4px");
    await expect(filled).toHaveCSS("border-top-right-radius", "4px");
    await expect(filled).toHaveCSS("border-bottom-left-radius", "0px");
    const outline = part(field(page, "outlined", "Empty"), "outline");
    await expect(outline).toHaveCSS("border-top-left-radius", "4px");
    await expect(outline).toHaveCSS("border-bottom-right-radius", "4px");

    // filled: the input sits below the floated label, 8px from the bottom
    const input = field(page, "filled", "Populated");
    const container = await box(part(input, "container"));
    const text = await box(input);
    expect(container.y + container.height - (text.y + text.height)).toBeCloseTo(
      8,
      1
    );
    // outlined: centered
    const outlined = field(page, "outlined", "Populated");
    const outlinedContainer = await box(part(outlined, "container"));
    const outlinedText = await box(outlined);
    expect(outlinedText.y - outlinedContainer.y).toBeCloseTo(16, 1);
  });

  test("the label rests in the empty field and floats above the input when focused or populated", async ({
    page,
  }) => {
    await settled(page);
    for (const caseId of ["filled", "outlined"] as const) {
      const empty = field(page, caseId, "Empty");
      await expect(part(empty, "label")).toHaveCSS("font-size", "16px");
      const resting = await labelOffset(empty);
      expect(resting.start).toBeCloseTo(16, 0);
      // centered in the 56px container
      expect(resting.top + resting.height / 2).toBeCloseTo(28, 0);

      const populated = await labelOffset(field(page, caseId, "Populated"));
      await expect(part(field(page, caseId, "Populated"), "label")).toHaveCSS(
        "font-size",
        "12px"
      );
      expect(populated.start).toBeCloseTo(16, 0);
      // filled: in the 16px line above the input, 8px from the top. Outlined: centered on the
      // container's top edge
      const floatedCenter = caseId === "filled" ? 16 : 0;
      expect(populated.top + populated.height / 2).toBeCloseTo(
        floatedCenter,
        0
      );

      await focusByKeyboard(page, empty);
      await expect(part(empty, "label")).toHaveCSS("font-size", "12px");
      const focused = await labelOffset(empty);
      expect(focused.top + focused.height / 2).toBeCloseTo(floatedCenter, 0);
    }
  });

  test("a placeholder shows only while the labelled field is focused", async ({
    page,
  }) => {
    for (const caseId of ["filled", "outlined"] as const) {
      const input = field(page, caseId, "With placeholder");
      await settled(page);
      expect(
        await input.evaluate(
          (el) => getComputedStyle(el, "::placeholder").opacity
        )
      ).toBe("0");
      await focusByKeyboard(page, input);
      expect(
        await input.evaluate(
          (el) => getComputedStyle(el, "::placeholder").opacity
        )
      ).toBe("1");
    }
    // without a label, it always shows
    await settled(page);
    expect(
      await field(page, "no-label", "Search filled").evaluate(
        (el) => getComputedStyle(el, "::placeholder").opacity
      )
    ).toBe("1");
  });

  test("filled: surface-container-highest with a 1px on-surface-variant indicator; focused, a 2px primary one and a primary label", async ({
    page,
  }) => {
    await settled(page);
    const input = field(page, "filled", "Empty");
    await expect(part(input, "container")).toHaveCSS(
      "background-color",
      await colorRole(page, "surface-container-highest")
    );
    await expect(part(input, "active-indicator")).toHaveCSS("height", "1px");
    await expect(part(input, "active-indicator")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-surface-variant")
    );
    await expect(part(input, "label")).toHaveCSS(
      "color",
      await colorRole(page, "on-surface-variant")
    );
    await expect(input).toHaveCSS("color", await colorRole(page, "on-surface"));
    await expect(input).toHaveCSS(
      "caret-color",
      await colorRole(page, "primary")
    );

    await focusByKeyboard(page, input);
    await expect(part(input, "active-indicator")).toHaveCSS("height", "2px");
    await expect(part(input, "active-indicator")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary")
    );
    await expect(part(input, "label")).toHaveCSS(
      "color",
      await colorRole(page, "primary")
    );
  });

  test("filled, hovered: an on-surface state layer at 8% and an on-surface indicator", async ({
    page,
  }) => {
    const input = field(page, "filled", "Empty");
    await expect(part(input, "state-layer")).toHaveCSS("opacity", "0");
    await part(input, "container").hover();
    await settled(page);
    await expect(part(input, "state-layer")).toHaveCSS("opacity", "0.08");
    await expect(part(input, "state-layer")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-surface")
    );
    await expect(part(input, "active-indicator")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-surface")
    );
  });

  test("outlined: a 1px outline; hovered, on-surface; focused, 3px primary with a primary label", async ({
    page,
  }) => {
    await settled(page);
    const input = field(page, "outlined", "Empty");
    const outline = part(input, "outline");
    await expect(part(input, "container")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)"
    );
    await expect(outline).toHaveCSS("border-top-width", "1px");
    await expect(outline).toHaveCSS(
      "border-top-color",
      await colorRole(page, "outline")
    );

    await part(input, "container").hover();
    await settled(page);
    await expect(outline).toHaveCSS(
      "border-top-color",
      await colorRole(page, "on-surface")
    );
    await expect(part(input, "label")).toHaveCSS(
      "color",
      await colorRole(page, "on-surface")
    );

    await focusByKeyboard(page, input);
    await expect(outline).toHaveCSS("border-top-width", "3px");
    await expect(outline).toHaveCSS(
      "border-top-color",
      await colorRole(page, "primary")
    );
    await expect(part(input, "label")).toHaveCSS(
      "color",
      await colorRole(page, "primary")
    );
    // the outline stays 56px tall, its top edge on the container's
    const container = await box(part(input, "container"));
    const outlineBox = await box(outline);
    expect(outlineBox.y + outlineBox.height).toBeCloseTo(
      container.y + container.height,
      0
    );
  });

  test("outlined: the floated label sits in a gap in the outline", async ({
    page,
  }) => {
    await settled(page);
    const input = field(page, "outlined", "Populated");
    const label = await textBox(part(input, "label"));
    const gap = await box(part(input, "outline").locator("legend"));
    // the gap is the label plus 4px each side
    expect(gap.x).toBeCloseTo(label.x - 4, 0);
    expect(gap.width).toBeCloseTo(label.width + 8, 0);

    // resting, there's no gap
    const empty = await box(
      part(field(page, "outlined", "Empty"), "outline").locator("legend")
    );
    expect(empty.width).toBeLessThan(1);
  });

  test("supporting text: Body Small, on-surface-variant, 4px below the container and 16px in, describing the input", async ({
    page,
  }) => {
    for (const [caseId, name] of [
      ["supporting-text", "Filled"],
      ["supporting-text", "Outlined"],
    ] as const) {
      const input = field(page, caseId, name);
      await expect(input).toHaveAccessibleDescription(
        `${name} supporting text`
      );
      const supporting = part(input, "supporting-text");
      await expect(supporting).toHaveCSS("font-size", "12px");
      await expect(supporting).toHaveCSS("line-height", "16px");
      await expect(supporting).toHaveCSS(
        "color",
        await colorRole(page, "on-surface-variant")
      );
      const container = await box(part(input, "container"));
      expect((await box(supporting)).y).toBeCloseTo(
        container.y + container.height,
        1
      );
      await expect(supporting).toHaveCSS("padding-top", "4px");
      expect(
        (await textBox(supporting.locator("span"))).x - container.x
      ).toBeCloseTo(16, 1);
    }
  });

  test("M3: the error text is an alert while the field is in error, and plain supporting text isn't", async ({
    page,
  }) => {
    const input = field(page, "error", "Filled");
    const supporting = part(input, "supporting-text");
    await expect(supporting).toHaveRole("alert");
    await expect(
      part(field(page, "supporting-text", "Filled"), "supporting-text")
    ).not.toHaveAttribute("role");

    // it follows aria-invalid as a script changes it
    await input.evaluate((el) => el.setAttribute("aria-invalid", "false"));
    await expect(supporting).not.toHaveAttribute("role");
    await input.evaluate((el) => el.setAttribute("aria-invalid", "true"));
    await expect(supporting).toHaveRole("alert");
  });

  test("a disabled field is marked aria-disabled, following the input as a script changes it", async ({
    page,
  }) => {
    const input = field(page, "disabled", "Filled");
    await expect(root(input)).toHaveAttribute("aria-disabled", "true");
    await input.evaluate((el: HTMLInputElement) => (el.disabled = false));
    await expect(root(input)).not.toHaveAttribute("aria-disabled");
    const enabled = field(page, "filled", "Empty");
    await expect(root(enabled)).not.toHaveAttribute("aria-disabled");
    await enabled.evaluate((el: HTMLInputElement) => (el.disabled = true));
    await expect(root(enabled)).toHaveAttribute("aria-disabled", "true");
  });

  test("error is announced with aria-invalid and uses M3's error roles", async ({
    page,
  }) => {
    await settled(page);
    for (const name of ["Filled", "Outlined"]) {
      const input = field(page, "error", name);
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(input).toHaveAccessibleDescription(`${name} error text`);
      await expect(input).toHaveCSS(
        "caret-color",
        await colorRole(page, "error")
      );
      for (const target of [
        part(input, "label"),
        part(input, "supporting-text"),
        part(input, "trailing-icon"),
      ]) {
        await expect(target).toHaveCSS("color", await colorRole(page, "error"));
      }
      await expect(input).toHaveCSS(
        "color",
        await colorRole(page, "on-surface")
      );
    }
    await expect(
      part(field(page, "error", "Filled"), "active-indicator")
    ).toHaveCSS("background-color", await colorRole(page, "error"));
    await expect(part(field(page, "error", "Outlined"), "outline")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "error")
    );

    // hovered, the label, indicator and trailing icon turn on-error-container
    const outlined = field(page, "error", "Outlined");
    await part(outlined, "container").hover();
    await settled(page);
    for (const target of [
      part(outlined, "label"),
      part(outlined, "trailing-icon"),
    ]) {
      await expect(target).toHaveCSS(
        "color",
        await colorRole(page, "on-error-container")
      );
    }
    await expect(part(outlined, "outline")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "on-error-container")
    );
    await expect(part(outlined, "supporting-text")).toHaveCSS(
      "color",
      await colorRole(page, "error")
    );
  });

  test("icons: 24px, 12px from the edges, 16px from the text; the trailing icon button is focusable", async ({
    page,
  }) => {
    await settled(page);
    for (const name of ["Filled", "Outlined"]) {
      const input = field(page, "icons", name);
      const container = await box(part(input, "container"));
      const leading = await box(part(input, "leading-icon").locator("svg"));
      const text = await box(input);
      expect(leading.width).toBeCloseTo(24, 1);
      expect(leading.height).toBeCloseTo(24, 1);
      expect(leading.x - container.x).toBeCloseTo(12, 1);
      expect(text.x - (leading.x + leading.width)).toBeCloseTo(16, 1);
      expect(leading.y + 12 - container.y).toBeCloseTo(28, 1);
      await expect(part(input, "leading-icon")).toHaveCSS(
        "color",
        await colorRole(page, "on-surface-variant")
      );

      const clear = page
        .getByTestId("text-field-icons")
        .getByRole("button", { name: `Clear ${name.toLowerCase()}` });
      const trailing = await box(clear.locator("svg"));
      expect(
        container.x + container.width - (trailing.x + trailing.width)
      ).toBeCloseTo(12, 1);
      await expect(clear).toHaveCSS(
        "color",
        await colorRole(page, "on-surface-variant")
      );

      await input.focus();
      await page.keyboard.press("Tab");
      await expect(clear).toBeFocused();
    }
  });

  test("with a leading icon, the label rests after it; floated, outlined's moves to the field's start", async ({
    page,
  }) => {
    await settled(page);
    for (const caseId of ["Filled", "Outlined"]) {
      const resting = await labelOffset(
        field(page, "icons", `${caseId} empty`)
      );
      expect(resting.start).toBeCloseTo(52, 0);
    }
    expect(
      (await labelOffset(field(page, "icons", "Filled"))).start
    ).toBeCloseTo(52, 0);
    expect(
      (await labelOffset(field(page, "icons", "Outlined"))).start
    ).toBeCloseTo(16, 0);
  });

  test("prefix and suffix: on-surface-variant, 2px from the input, shown once the label floats, and describing the input", async ({
    page,
  }) => {
    await settled(page);
    const price = field(page, "prefix-suffix", "Filled price", "spinbutton");
    const email = field(page, "prefix-suffix", "Outlined email");
    await expect(price).toHaveAccessibleDescription("Euro");
    await expect(email).toHaveAccessibleDescription("@gmail.com");

    // the empty field's prefix waits for the label to float
    await expect(part(price, "prefix")).toHaveCSS("opacity", "0");
    await focusByKeyboard(page, price);
    await expect(part(price, "prefix")).toHaveCSS("opacity", "1");
    await expect(part(price, "prefix")).toHaveCSS(
      "color",
      await colorRole(page, "on-surface-variant")
    );
    const prefix = await box(part(price, "prefix"));
    expect((await box(price)).x - (prefix.x + prefix.width)).toBeCloseTo(2, 1);

    await expect(part(email, "suffix")).toHaveCSS("opacity", "1");
    const suffix = await box(part(email, "suffix"));
    const input = await box(email);
    expect(suffix.x - (input.x + input.width)).toBeCloseTo(2, 1);
    // the suffix ends 16px before the container's end
    const container = await box(part(email, "container"));
    expect(
      container.x + container.width - (suffix.x + suffix.width)
    ).toBeCloseTo(16, 1);
  });

  test("clicking anywhere in the container focuses the input", async ({
    page,
  }) => {
    const input = field(page, "prefix-suffix", "Outlined email");
    await part(input, "suffix").click();
    await expect(input).toBeFocused();

    const filled = field(page, "filled", "Empty");
    await part(filled, "container").click({ position: { x: 8, y: 4 } });
    await expect(filled).toBeFocused();
  });

  test("disabled: on-surface at 38%, a 4% filled container or a 12% outline, and can't be focused", async ({
    page,
  }) => {
    await settled(page);
    const filled = field(page, "disabled", "Filled");
    const outlined = field(page, "disabled", "Outlined");
    for (const input of [filled, outlined]) {
      await expect(input).toBeDisabled();
      for (const target of [
        input,
        part(input, "label"),
        part(input, "leading-icon"),
        part(input, "supporting-text"),
      ]) {
        await expect(target).toHaveCSS(
          "color",
          await mixedRole(page, "on-surface", 38)
        );
      }
    }
    await expect(part(filled, "container")).toHaveCSS(
      "background-color",
      await mixedRole(page, "on-surface", 4)
    );
    await expect(part(filled, "active-indicator")).toHaveCSS(
      "background-color",
      await mixedRole(page, "on-surface", 38)
    );
    await expect(part(outlined, "outline")).toHaveCSS(
      "border-top-color",
      await mixedRole(page, "on-surface", 12)
    );

    await part(filled, "container").hover();
    await expect(part(filled, "state-layer")).toHaveCSS("opacity", "0");
    await part(filled, "container").click({ force: true });
    await expect(filled).not.toBeFocused();
  });

  test("works in a native form: values submit, reset restores them, required validates", async ({
    page,
  }) => {
    const form = page.getByTestId("text-field-form").locator("form");
    const values = () =>
      form.evaluate((el: HTMLFormElement) =>
        Object.fromEntries(new FormData(el))
      );

    expect(await values()).toEqual({ city: "Paris", username: "" });
    await field(page, "form", "City").fill("Rome");
    await field(page, "form", "Username*").fill("ada");
    expect(await values()).toEqual({ city: "Rome", username: "ada" });

    await form.getByRole("button", { name: "Reset" }).click();
    expect(await values()).toEqual({ city: "Paris", username: "" });

    // submitting with the required field empty marks it invalid, in the error colors
    const username = field(page, "form", "Username*");
    await form.getByRole("button", { name: "Submit" }).click();
    await expect(username).toBeFocused();
    await page.mouse.move(0, 0);
    await expect(part(username, "outline")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "error")
    );
    await expect(part(username, "supporting-text")).toHaveCSS(
      "color",
      await colorRole(page, "error")
    );
    // M3: the error text is an alert
    await expect(part(username, "supporting-text")).toHaveRole("alert");
    await username.fill("ada");
    await expect(part(username, "outline")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "primary")
    );
    await expect(part(username, "supporting-text")).not.toHaveAttribute("role");
  });

  test("mirrors right to left: the leading icon, label and supporting text start at the right", async ({
    page,
  }) => {
    await settled(page);
    for (const name of ["Filled", "Outlined"]) {
      const input = field(page, "rtl", name);
      const container = await box(part(input, "container"));
      const leading = await box(part(input, "leading-icon").locator("svg"));
      const label = await textBox(part(input, "label"));
      const end = container.x + container.width;
      expect(end - (leading.x + leading.width)).toBeCloseTo(12, 1);
      // floated, outlined's label moves to 16px from the field's (right-hand) start
      expect(end - (label.x + label.width)).toBeCloseTo(
        name === "Filled" ? 52 : 16,
        0
      );
    }
    const supporting = part(field(page, "rtl", "Filled"), "supporting-text");
    const container = await box(
      part(field(page, "rtl", "Filled"), "container")
    );
    const text = await textBox(supporting.locator("span"));
    expect(container.x + container.width - (text.x + text.width)).toBeCloseTo(
      16,
      0
    );
  });

  test("on a colored background, both variants keep M3's roles", async ({
    page,
  }) => {
    await settled(page);
    for (const name of ["Filled", "Outlined"]) {
      const input = field(page, "on-secondary-container", name);
      await expect(part(input, "label")).toHaveCSS(
        "color",
        await colorRole(page, "on-surface-variant")
      );
      await expect(input).toHaveCSS(
        "color",
        await colorRole(page, "on-surface")
      );
      await expect(part(input, "supporting-text")).toHaveCSS(
        "color",
        await colorRole(page, "on-surface-variant")
      );
    }
    await expect(
      part(field(page, "on-secondary-container", "Filled"), "container")
    ).toHaveCSS(
      "background-color",
      await colorRole(page, "surface-container-highest")
    );
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing transitions", async ({ page }) => {
      for (const [caseId, names] of [
        ["filled", ["state-layer", "active-indicator", "label"]],
        ["outlined", ["outline", "label"]],
      ] as const) {
        const input = field(page, caseId, "Empty");
        for (const name of names) {
          expect(await style(part(input, name), "transition-duration")).toMatch(
            /^0s(, 0s)*$/
          );
        }
      }
    });
  });
});
