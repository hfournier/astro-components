import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  expectFocusRing,
  resolvedColor,
  settled,
  textBox,
} from "./support/helpers";

// Each case on /tests/switch is a Section with data-testid="switch-<caseId>". Each switch is
// named by its label.
type SwitchCaseId =
  | "states"
  | "icons"
  | "disabled"
  | "no-label"
  | "form"
  | "rtl"
  | "on-secondary-container";

const section = (page: Page, caseId: SwitchCaseId) =>
  page.getByTestId(`switch-${caseId}`);

const toggle = (page: Page, caseId: SwitchCaseId, name: string) =>
  section(page, caseId).getByRole("switch", { name, exact: true });

// The <label> around the input
const label = (input: Locator) => input.locator("xpath=ancestor::label[1]");

// The parts M3's anatomy names (track, handle, icon), plus the state layer and the 48px target
const part = (
  input: Locator,
  name: "target" | "track" | "handle" | "state-layer"
) => label(input).locator(`[data-ac-switch-part="${name}"]`);

// The handle's icon for each state: a check when selected, an x when unselected
const icon = (input: Locator, state: "selected" | "unselected") =>
  label(input).locator(`[data-ac-switch-icon="${state}"]`);

const style = (target: Locator, property: string) =>
  target.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );

const colorRole = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

const roleAt = (page: Page, name: string, percent: number) =>
  resolvedColor(
    page,
    `color-mix(in oklab, var(--theme-color-${name}) ${percent}%, transparent)`
  );

// The handle's size, and its center's distance from the track's start edge (its left in LTR,
// its right in RTL)
const handleGeometry = async (input: Locator, isRtl = false) => {
  const track = await box(part(input, "track"));
  const handle = await box(part(input, "handle"));
  const center = handle.x + handle.width / 2;
  return {
    width: handle.width,
    height: handle.height,
    fromStart: isRtl ? track.x + track.width - center : center - track.x,
    centeredY: Math.abs(
      handle.y + handle.height / 2 - (track.y + track.height / 2)
    ),
  };
};

test.describe("Switch", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/switch");
  });

  test("is a native checkbox exposed as a switch, named by its label", async ({
    page,
  }) => {
    const wifi = toggle(page, "states", "Wi-Fi");
    await expect(wifi).toHaveAttribute("type", "checkbox");
    await expect(wifi).not.toBeChecked();
    await expect(toggle(page, "states", "Bluetooth")).toBeChecked();
    await expect(toggle(page, "no-label", "Airplane mode")).toBeVisible();
    // the icons are decoration: the switch's state is its own
    await expect(
      icon(toggle(page, "icons", "Both, selected"), "selected")
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("clicking the label toggles it", async ({ page }) => {
    const wifi = toggle(page, "states", "Wi-Fi");
    await section(page, "states").getByText("Wi-Fi", { exact: true }).click();
    await expect(wifi).toBeChecked();
    await wifi.click();
    await expect(wifi).not.toBeChecked();
  });

  test("Space and Enter toggle it, as M3's keyboard table asks", async ({
    page,
  }) => {
    const wifi = toggle(page, "states", "Wi-Fi");
    await wifi.focus();
    await page.keyboard.press("Space");
    await expect(wifi).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(wifi).not.toBeChecked();
  });

  test("matches M3's measurements: 52x32 track with a 2px outline, 40px state layer, 48px target", async ({
    page,
  }) => {
    await settled(page);
    const input = toggle(page, "states", "Wi-Fi");
    const track = await box(part(input, "track"));
    const stateLayer = await box(part(input, "state-layer"));
    const target = await box(part(input, "target"));
    const handle = await box(part(input, "handle"));

    expect([track.width, track.height]).toEqual([52, 32]);
    expect([stateLayer.width, stateLayer.height]).toEqual([40, 40]);
    expect(target.height).toBe(48);
    expect(target.width).toBeGreaterThanOrEqual(48);
    await expect(part(input, "track")).toHaveCSS("border-top-width", "2px");

    // the state layer follows the handle
    expect(stateLayer.x + stateLayer.width / 2).toBeCloseTo(
      handle.x + handle.width / 2
    );
    expect(stateLayer.y + stateLayer.height / 2).toBeCloseTo(
      handle.y + handle.height / 2
    );

    // rounded-full: a radius of at least half its height
    for (const name of ["track", "handle", "state-layer"] as const) {
      expect(
        parseFloat(await style(part(input, name), "border-top-left-radius"))
      ).toBeGreaterThanOrEqual(8);
    }
  });

  test("the handle is 16px at the start unselected, 24px at the end selected", async ({
    page,
  }) => {
    await settled(page);
    expect(await handleGeometry(toggle(page, "states", "Wi-Fi"))).toEqual({
      width: 16,
      height: 16,
      fromStart: 16,
      centeredY: 0,
    });
    expect(await handleGeometry(toggle(page, "states", "Bluetooth"))).toEqual({
      width: 24,
      height: 24,
      fromStart: 36,
      centeredY: 0,
    });
  });

  test("toggling moves the handle across and resizes it", async ({ page }) => {
    const wifi = toggle(page, "states", "Wi-Fi");
    await wifi.click();
    await page.mouse.move(0, 0);
    await settled(page);
    expect(await handleGeometry(wifi)).toMatchObject({
      width: 24,
      fromStart: 36,
    });
  });

  test("with icons: a 24px handle, with a 16px check selected and an x unselected only on both", async ({
    page,
  }) => {
    await settled(page);
    const selectedOnlyOff = toggle(page, "icons", "Selected only, unselected");
    const selectedOnlyOn = toggle(page, "icons", "Selected only, selected");
    const bothOff = toggle(page, "icons", "Both, unselected");
    const bothOn = toggle(page, "icons", "Both, selected");

    // selected only: unselected stays a bare 16px handle
    expect((await handleGeometry(selectedOnlyOff)).width).toBe(16);
    await expect(icon(selectedOnlyOff, "selected")).toHaveCSS("opacity", "0");
    await expect(icon(selectedOnlyOff, "unselected")).toHaveCount(0);
    await expect(icon(selectedOnlyOn, "selected")).toHaveCSS("opacity", "1");

    // both: the unselected handle grows to 24px to hold its icon
    expect(await handleGeometry(bothOff)).toMatchObject({
      width: 24,
      fromStart: 16,
    });
    await expect(icon(bothOff, "unselected")).toHaveCSS("opacity", "1");
    await expect(icon(bothOff, "selected")).toHaveCSS("opacity", "0");
    await expect(icon(bothOn, "selected")).toHaveCSS("opacity", "1");
    await expect(icon(bothOn, "unselected")).toHaveCSS("opacity", "0");

    const check = await box(icon(bothOn, "selected"));
    expect([check.width, check.height]).toEqual([16, 16]);
  });

  test("colors: unselected and selected track, outline, handle and icon", async ({
    page,
  }) => {
    await settled(page);
    const off = toggle(page, "icons", "Both, unselected");
    const on = toggle(page, "icons", "Both, selected");

    await expect(part(off, "track")).toHaveCSS(
      "background-color",
      await colorRole(page, "surface-container-highest")
    );
    await expect(part(off, "track")).toHaveCSS(
      "border-top-color",
      await colorRole(page, "outline")
    );
    await expect(part(off, "handle")).toHaveCSS(
      "background-color",
      await colorRole(page, "outline")
    );
    await expect(icon(off, "unselected")).toHaveCSS(
      "color",
      await colorRole(page, "surface-container-highest")
    );

    await expect(part(on, "track")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary")
    );
    await expect(part(on, "track")).toHaveCSS(
      "border-top-color",
      "rgba(0, 0, 0, 0)"
    );
    await expect(part(on, "handle")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-primary")
    );
    await expect(icon(on, "selected")).toHaveCSS(
      "color",
      await colorRole(page, "on-primary-container")
    );

    // the label stays on-surface, selected or not
    await expect(label(off)).toHaveCSS(
      "color",
      await colorRole(page, "on-surface")
    );
    await expect(label(on)).toHaveCSS(
      "color",
      await colorRole(page, "on-surface")
    );
  });

  test("disabled: M3's disabled colors, and it can't be toggled", async ({
    page,
  }) => {
    await settled(page);
    const off = toggle(page, "disabled", "Unselected");
    const on = toggle(page, "disabled", "Selected");
    await expect(off).toBeDisabled();

    await expect(part(off, "track")).toHaveCSS(
      "background-color",
      await roleAt(page, "surface-container-highest", 12)
    );
    await expect(part(off, "track")).toHaveCSS(
      "border-top-color",
      await roleAt(page, "on-surface", 12)
    );
    await expect(part(off, "handle")).toHaveCSS(
      "background-color",
      await roleAt(page, "on-surface", 38)
    );
    await expect(icon(off, "unselected")).toHaveCSS(
      "color",
      await roleAt(page, "surface-container-highest", 38)
    );

    await expect(part(on, "track")).toHaveCSS(
      "background-color",
      await roleAt(page, "on-surface", 12)
    );
    await expect(part(on, "handle")).toHaveCSS(
      "background-color",
      await colorRole(page, "surface")
    );
    await expect(icon(on, "selected")).toHaveCSS(
      "color",
      await roleAt(page, "on-surface", 38)
    );
    await expect(label(off)).toHaveCSS(
      "color",
      await roleAt(page, "on-surface", 38)
    );

    await section(page, "disabled")
      .getByText("Unselected", { exact: true })
      .click({ force: true });
    await expect(off).not.toBeChecked();
    await expect(part(off, "state-layer")).toHaveCSS("opacity", "0");
  });

  test("hovered: an 8% state layer, and the handle darkens", async ({
    page,
  }) => {
    const off = toggle(page, "states", "Wi-Fi");
    const on = toggle(page, "states", "Bluetooth");
    await expect(part(off, "state-layer")).toHaveCSS("opacity", "0");

    await off.hover();
    await expect(part(off, "state-layer")).toHaveCSS("opacity", "0.08");
    await expect(part(off, "state-layer")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-surface")
    );
    await expect(part(off, "handle")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-surface-variant")
    );

    await on.hover();
    await expect(part(on, "state-layer")).toHaveCSS("opacity", "0.08");
    await expect(part(on, "state-layer")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary")
    );
    await expect(part(on, "handle")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary-container")
    );
  });

  test("focused: a 10% state layer, the darker handle and the focus ring", async ({
    page,
  }) => {
    const off = toggle(page, "states", "Wi-Fi");
    const on = toggle(page, "states", "Bluetooth");
    await off.focus();
    await page.keyboard.press("Tab");
    await expect(on).toBeFocused();
    await expect(part(on, "state-layer")).toHaveCSS("opacity", "0.1");
    await expect(part(on, "handle")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary-container")
    );
    await expectFocusRing(on);

    // the ring is drawn around the track
    const ring = await box(on);
    const track = await box(part(on, "track"));
    expect(ring).toEqual(track);

    // focused and hovered, focus's 10% wins
    await on.hover();
    await settled(page);
    expect(await style(part(on, "state-layer"), "opacity")).toBe("0.1");
  });

  // One press per test, as in Checkbox.spec.ts: in Firefox, after a press on a label, the next
  // press elsewhere doesn't match :active until the focused input is blurred
  for (const [name, fromStart, color] of [
    ["Wi-Fi", 16, "on-surface"],
    ["Bluetooth", 36, "primary"],
  ] as const) {
    test(`pressed, the handle grows to 28px in place: ${name}`, async ({
      page,
    }) => {
      const input = toggle(page, "states", name);
      await input.hover();
      await page.mouse.down();
      await expect(part(input, "state-layer")).toHaveCSS("opacity", "0.1");
      await expect(part(input, "state-layer")).toHaveCSS(
        "background-color",
        await colorRole(page, color)
      );
      // Compose snaps the handle to its pressed size
      await settled(page);
      expect(await handleGeometry(input)).toMatchObject({
        width: 28,
        height: 28,
        fromStart,
      });
      await page.mouse.up();
    });
  }

  test("works in a native form: submits its value when on, resets, and validates required", async ({
    page,
  }) => {
    const form = section(page, "form").locator("form");
    const value = (name: string) =>
      form.evaluate((el: HTMLFormElement, n) => new FormData(el).get(n), name);

    expect(await value("sync")).toBe("on");
    await toggle(page, "form", "Sync").uncheck();
    expect(await value("sync")).toBeNull();

    await form.getByRole("button", { name: "Reset" }).click();
    expect(await value("sync")).toBe("on");

    await form.getByRole("button", { name: "Submit" }).click();
    const terms = toggle(page, "form", "Accept terms");
    await expect(terms).toBeFocused();
    expect(
      await form.evaluate((el: HTMLFormElement) => el.checkValidity())
    ).toBe(false);
    await page.keyboard.press("Space");
    expect(
      await form.evaluate((el: HTMLFormElement) => el.checkValidity())
    ).toBe(true);
  });

  test("Enter doesn't toggle a switch in a form twice or submit it", async ({
    page,
  }) => {
    const form = section(page, "form").locator("form");
    await form.evaluate((el: HTMLFormElement) => {
      el.dataset.submits = "0";
      el.addEventListener("submit", () => {
        el.dataset.submits = String(Number(el.dataset.submits) + 1);
      });
    });
    const sync = toggle(page, "form", "Sync");
    await sync.focus();
    await page.keyboard.press("Enter");
    await expect(sync).not.toBeChecked();
    await expect(form).toHaveAttribute("data-submits", "0");
  });

  test("mirrors right to left: the label on the right, the handle moving leftward", async ({
    page,
  }) => {
    await settled(page);
    const off = toggle(page, "rtl", "Unselected");
    const on = toggle(page, "rtl", "Selected");
    expect((await handleGeometry(off, true)).fromStart).toBe(16);
    expect((await handleGeometry(on, true)).fromStart).toBe(36);

    // the label's text sits on the switch's right: the reading start
    const target = await box(part(off, "target"));
    const text = await textBox(label(off));
    expect(text.x).toBeGreaterThanOrEqual(target.x + target.width - 0.5);
  });

  test("the label's text comes before the switch in LTR", async ({ page }) => {
    const input = toggle(page, "states", "Wi-Fi");
    const target = await box(part(input, "target"));
    const text = await textBox(label(input));
    expect(text.x + text.width).toBeLessThanOrEqual(target.x + 0.5);
  });

  test("on a colored background, the label and unselected state layer follow its on-color", async ({
    page,
  }) => {
    const input = toggle(page, "on-secondary-container", "Unselected");
    await expect(label(input)).toHaveCSS(
      "color",
      await colorRole(page, "on-secondary-container")
    );
    await input.hover();
    await expect(part(input, "state-layer")).toHaveCSS(
      "background-color",
      await colorRole(page, "on-secondary-container")
    );
  });

  // ADR-0018: position, size and shape on fast spatial; color and opacity on fast effects
  test("the handle moves and resizes on fast spatial; colors change on fast effects", async ({
    page,
  }) => {
    const input = toggle(page, "states", "Wi-Fi");
    const timing = async (target: Locator, property: string) => {
      const properties = (await style(target, "transition-property")).split(
        ", "
      );
      const index = properties.indexOf(property);
      expect(index, `${property} transitions`).toBeGreaterThanOrEqual(0);
      const durations = (await style(target, "transition-duration")).split(
        ", "
      );
      const easings = (await style(target, "transition-timing-function")).split(
        /,\s(?![^(]*\))/
      );
      return {
        duration: parseFloat(durations[index]) * 1000,
        easing: easings[index],
      };
    };
    const token = async (name: string) => ({
      duration: parseFloat(
        await style(page.locator("html"), `--theme-duration-spring-${name}`)
      ),
      easing: await resolvedEasing(page, `--ease-spring-${name}`),
    });

    const spatial = await token("fast-spatial");
    const effects = await token("fast-effects");
    for (const property of ["translate", "width", "height"]) {
      expect(await timing(part(input, "handle"), property)).toEqual(spatial);
    }
    expect(await timing(part(input, "handle"), "background-color")).toEqual(
      effects
    );
    expect(await timing(part(input, "state-layer"), "translate")).toEqual(
      spatial
    );
    for (const property of ["background-color", "border-color"]) {
      expect(await timing(part(input, "track"), property)).toEqual(effects);
    }
    const withIcon = toggle(page, "icons", "Both, selected");
    expect(await timing(icon(withIcon, "selected"), "opacity")).toEqual(
      effects
    );
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing transitions", async ({ page }) => {
      const input = toggle(page, "states", "Wi-Fi");
      for (const name of ["track", "handle", "state-layer"] as const) {
        expect(await style(part(input, name), "transition-duration")).toMatch(
          /^0s(, 0s)*$/
        );
      }
      const withIcon = toggle(page, "icons", "Both, selected");
      expect(
        await style(icon(withIcon, "selected"), "transition-duration")
      ).toMatch(/^0s(, 0s)*$/);
    });
  });
});

// A timing-function custom property as the browser serializes it in transition-timing-function
const resolvedEasing = (page: Page, property: string) =>
  page.evaluate((p) => {
    const probe = document.createElement("div");
    probe.style.transitionTimingFunction = `var(${p})`;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).transitionTimingFunction;
    probe.remove();
    return resolved;
  }, property);
