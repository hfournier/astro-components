import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, css, expectFocusRing, resolvedColor } from "./support/helpers";

// Each case on /tests/slider is a Section with data-testid="slider-<caseId>". Each slider is
// named by its aria-label.
type SliderCaseId =
  | "sizes"
  | "values"
  | "stops"
  | "value-indicator"
  | "icon"
  | "vertical"
  | "disabled"
  | "form"
  | "rtl"
  | "centered"
  | "variant-sizes"
  | "range";

const section = (page: Page, caseId: SliderCaseId) =>
  page.getByTestId(`slider-${caseId}`);

const slider = (page: Page, caseId: SliderCaseId, name: string) =>
  section(page, caseId).getByRole("slider", { name, exact: true });

// The element around the input, which draws the slider
const root = (input: Locator) =>
  input.locator("xpath=ancestor::*[@data-ac-slider][1]");

type Part =
  | "track"
  | "active-track"
  | "inactive-track"
  | "inactive-track-start"
  | "handle-position"
  | "handle"
  | "stop"
  | "icon"
  | "value-indicator"
  | "value";

const part = (input: Locator, name: Part) =>
  root(input).locator(`[data-ac-slider-part="${name}"]`);

// A part of the handle an input moves: on a range slider, each input has its own
const handlePart = (
  input: Locator,
  name: "handle-position" | "handle" | "value-indicator" | "value"
) =>
  name === "handle-position"
    ? input.locator("xpath=..")
    : input.locator(`xpath=..//*[@data-ac-slider-part="${name}"]`);

// The stops (or the icon) drawn in one track: each is drawn in every track, and clipped by each
const partIn = (
  input: Locator,
  track: "active-track" | "inactive-track" | "inactive-track-start",
  name: "stop" | "icon"
) => part(input, track).locator(`[data-ac-slider-part="${name}"]`);

const colorRole = (page: Page, name: string) =>
  resolvedColor(page, `var(--theme-color-${name})`);

const roleAt = (page: Page, name: string, percent: number) =>
  resolvedColor(
    page,
    `color-mix(in oklab, var(--theme-color-${name}) ${percent}%, transparent)`
  );

// Distances along a horizontal track from its start: its left, or its right in RTL
const along = async (input: Locator, target: Locator, isRtl = false) => {
  const track = await box(part(input, "track"));
  const rect = await box(target);
  return isRtl
    ? {
        start: track.x + track.width - (rect.x + rect.width),
        end: track.x + track.width - rect.x,
        length: track.width,
      }
    : {
        start: rect.x - track.x,
        end: rect.x + rect.width - track.x,
        length: track.width,
      };
};

// Where the handle's center is along the track
const handleAt = async (input: Locator, isRtl = false) => {
  const { start, end } = await along(
    input,
    part(input, "handle-position"),
    isRtl
  );
  return (start + end) / 2;
};

// Whether a stop or icon shows: it lies inside the track that draws it, which clips it
const showsIn = async (target: Locator, track: Locator) => {
  const rect = await target.boundingBox();
  const clip = await track.boundingBox();
  if (!rect || !clip || clip.width === 0 || clip.height === 0) return false;
  return (
    rect.x >= clip.x - 0.5 &&
    rect.x + rect.width <= clip.x + clip.width + 0.5 &&
    rect.y >= clip.y - 0.5 &&
    rect.y + rect.height <= clip.y + clip.height + 0.5
  );
};

// A point along the track, from its start, for the pointer
const pointAlong = async (input: Locator, distance: number, isRtl = false) => {
  await root(input).scrollIntoViewIfNeeded();
  const track = await box(part(input, "track"));
  return {
    x: isRtl ? track.x + track.width - distance : track.x + distance,
    y: track.y + track.height / 2,
  };
};

test.describe("Slider", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/slider");
  });

  test("is a native range input, named by its aria-label or label", async ({
    page,
  }) => {
    const input = slider(page, "sizes", "Extra small");
    await expect(input).toHaveAttribute("type", "range");
    // The browser's default value, halfway
    await expect(input).toHaveValue("50");
    await expect(slider(page, "form", "Volume")).toHaveValue("20");
    await expect(slider(page, "vertical", "Vertical")).toHaveAttribute(
      "aria-orientation",
      "vertical"
    );
    await expect(input).not.toHaveAttribute("aria-orientation");
    // The value indicator repeats the input's value, so it's hidden from assistive tech
    await expect(
      part(slider(page, "value-indicator", "Volume"), "value")
    ).toHaveAttribute("aria-hidden", "true");
  });

  for (const [name, thickness, handle, corner, height] of [
    ["Extra small", 16, 44, 8, 48],
    ["Small", 24, 44, 8, 48],
    ["Medium", 40, 52, 12, 52],
    ["Large", 56, 68, 16, 68],
    ["Extra large", 96, 108, 28, 108],
  ] as const) {
    test(`matches M3's measurements: ${name}`, async ({ page }) => {
      const input = slider(page, "sizes", name);
      const slide = await box(root(input));
      const track = await box(part(input, "track"));
      const handleBox = await box(part(input, "handle"));
      // A 48px target at least, around the handle
      expect(slide.height).toBe(height);
      expect(track.height).toBe(thickness);
      expect([handleBox.width, handleBox.height]).toEqual([4, handle]);
      // The track and handle are centered across the slider, the track inset by half the
      // handle at each end so the handle stays inside it
      expect(track.y + track.height / 2).toBeCloseTo(
        slide.y + slide.height / 2
      );
      expect(handleBox.y + handleBox.height / 2).toBeCloseTo(
        slide.y + slide.height / 2
      );
      expect([
        track.x - slide.x,
        slide.x + slide.width - track.x - track.width,
      ]).toEqual([2, 2]);

      // The track's outer corners are M3's size; the ones beside the handle 2px
      await expect(part(input, "active-track")).toHaveCSS(
        "border-top-left-radius",
        `${corner}px`
      );
      await expect(part(input, "active-track")).toHaveCSS(
        "border-top-right-radius",
        "2px"
      );
      await expect(part(input, "inactive-track")).toHaveCSS(
        "border-top-left-radius",
        "2px"
      );
      await expect(part(input, "inactive-track")).toHaveCSS(
        "border-bottom-right-radius",
        `${corner}px`
      );
      expect(
        parseFloat(await css(part(input, "handle"), "border-top-left-radius"))
      ).toBeGreaterThanOrEqual(2);
    });
  }

  test("the handle sits at the value, with M3's 6px gap to each track", async ({
    page,
  }) => {
    const input = slider(page, "values", "At 30");
    const { length } = await along(input, part(input, "track"));
    const at = await handleAt(input);
    expect(at).toBeCloseTo(length * 0.3, 0);

    const active = await along(input, part(input, "active-track"));
    const inactive = await along(input, part(input, "inactive-track"));
    expect(active.start).toBe(0);
    // half the 4px handle and the 6px gap
    expect(active.end).toBeCloseTo(at - 8, 0);
    expect(inactive.start).toBeCloseTo(at + 8, 0);
    expect(inactive.end).toBeCloseTo(length, 0);

    // Another range: -10 to 10, at 2.5
    const other = slider(page, "values", "From -10 to 10");
    expect(await handleAt(other)).toBeCloseTo(
      (await along(other, part(other, "track"))).length * 0.625,
      0
    );
  });

  test("at either end, the handle is at the track's end, and the track too short to draw isn't drawn", async ({
    page,
  }) => {
    const atMin = slider(page, "values", "At the minimum");
    expect(await handleAt(atMin)).toBeCloseTo(0, 0);
    expect((await box(part(atMin, "active-track"))).width).toBe(0);

    const atMax = slider(page, "values", "At the maximum");
    const { length } = await along(atMax, part(atMax, "track"));
    expect(await handleAt(atMax)).toBeCloseTo(length, 0);
    expect((await box(part(atMax, "inactive-track"))).width).toBe(0);
  });

  test("the stop indicator: a 4px circle 4px in from the end of the inactive track, in on-secondary-container", async ({
    page,
  }) => {
    const input = slider(page, "values", "At 30");
    const stop = partIn(input, "inactive-track", "stop");
    await expect(stop).toHaveCount(1);
    const { start, end, length } = await along(input, stop);
    expect(end - start).toBe(4);
    expect(length - end).toBeCloseTo(4, 0);
    const stopBox = await box(stop);
    expect(stopBox.height).toBe(4);
    const track = await box(part(input, "track"));
    expect(stopBox.y + 2).toBeCloseTo(track.y + track.height / 2);
    await expect(stop).toHaveCSS(
      "background-color",
      await colorRole(page, "on-secondary-container")
    );
    expect(await showsIn(stop, part(input, "inactive-track"))).toBe(true);

    // Without one, there's none
    await expect(
      part(slider(page, "values", "Without a stop indicator"), "stop")
    ).toHaveCount(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`colors, ${colorScheme}: primary handle and active track, secondary-container inactive track, inverse value indicator`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: "light" });
      const lightPrimary = await colorRole(page, "primary");
      await page.emulateMedia({ colorScheme });
      // The dark run checks the dark roles, which differ from the light ones
      expect(lightPrimary === (await colorRole(page, "primary"))).toBe(
        colorScheme === "light"
      );
      const input = slider(page, "stops", "Every 10");
      await expect(part(input, "handle")).toHaveCSS(
        "background-color",
        await colorRole(page, "primary")
      );
      await expect(part(input, "active-track")).toHaveCSS(
        "background-color",
        await colorRole(page, "primary")
      );
      await expect(part(input, "inactive-track")).toHaveCSS(
        "background-color",
        await colorRole(page, "secondary-container")
      );
      await expect(partIn(input, "active-track", "stop").first()).toHaveCSS(
        "background-color",
        await colorRole(page, "on-primary")
      );
      await expect(partIn(input, "inactive-track", "stop").last()).toHaveCSS(
        "background-color",
        await colorRole(page, "on-secondary-container")
      );
      await expect(
        part(slider(page, "value-indicator", "Volume"), "value")
      ).toHaveCSS("background-color", await colorRole(page, "inverse-surface"));

      // A centered and a range slider's tracks, the inactive one at the start too, and both
      // handles
      const centered = slider(page, "centered", "Centered with stops");
      const start = slider(page, "range", "From");
      const end = slider(page, "range", "To");
      for (const input of [centered, start]) {
        await expect(part(input, "inactive-track-start")).toHaveCSS(
          "background-color",
          await colorRole(page, "secondary-container")
        );
        await expect(
          partIn(input, "inactive-track-start", "stop").first()
        ).toHaveCSS(
          "background-color",
          await colorRole(page, "on-secondary-container")
        );
        await expect(part(input, "active-track")).toHaveCSS(
          "background-color",
          await colorRole(page, "primary")
        );
      }
      for (const input of [centered, start, end])
        await expect(handlePart(input, "handle")).toHaveCSS(
          "background-color",
          await colorRole(page, "primary")
        );
    });
  }

  test("hovered, the pointer becomes a hand, as M3 asks; nothing else changes", async ({
    page,
  }) => {
    const input = slider(page, "values", "At 30");
    await root(input).hover();
    await expect(root(input)).toHaveCSS("cursor", "pointer");
    await expect(part(input, "handle")).toHaveCSS("width", "4px");
    await expect(part(input, "handle")).toHaveCSS(
      "background-color",
      await colorRole(page, "primary")
    );
  });

  test("stops: one at every step, on-primary on the active track and on-secondary-container on the inactive one", async ({
    page,
  }) => {
    const input = slider(page, "stops", "Every 10");
    const active = partIn(input, "active-track", "stop");
    const inactive = partIn(input, "inactive-track", "stop");
    await expect(active).toHaveCount(11);
    await expect(inactive).toHaveCount(11);
    await expect(active.first()).toHaveCSS(
      "background-color",
      await colorRole(page, "on-primary")
    );
    await expect(inactive.first()).toHaveCSS(
      "background-color",
      await colorRole(page, "on-secondary-container")
    );

    // The first and last stops are 6px in from the ends, centered; the others evenly between.
    // Between the ends, the handle sits over its stop, which the gap hides.
    const { length } = await along(input, part(input, "track"));
    const centers = await Promise.all(
      Array.from({ length: 11 }, async (_, i) => {
        const { start, end } = await along(input, active.nth(i));
        return (start + end) / 2;
      })
    );
    centers.forEach((center, i) =>
      expect(center).toBeCloseTo(6 + ((length - 12) * i) / 10, 0)
    );
    expect(await handleAt(input)).toBeCloseTo(centers[3]!, 0);

    const shown = async (stops: Locator, track: Part) =>
      Promise.all(
        Array.from({ length: 11 }, (_, i) =>
          showsIn(stops.nth(i), part(input, track))
        )
      );
    expect(await shown(active, "active-track")).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(await shown(inactive, "inactive-track")).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  test("stops: at the first stop, the handle is at the track's start", async ({
    page,
  }) => {
    const input = slider(page, "stops", "From 1 to 5");
    await expect(partIn(input, "active-track", "stop")).toHaveCount(5);
    expect(await handleAt(input)).toBeCloseTo(0, 0);
  });

  test("a press on the track moves the handle there at once, and dragging follows the pointer", async ({
    page,
  }) => {
    const input = slider(page, "values", "At 30");
    await input.evaluate((el: HTMLInputElement) => {
      el.dataset.inputs = "0";
      el.dataset.changes = "0";
      el.addEventListener("input", () => {
        el.dataset.inputs = String(Number(el.dataset.inputs) + 1);
      });
      el.addEventListener("change", () => {
        el.dataset.changes = String(Number(el.dataset.changes) + 1);
      });
    });
    const { length } = await along(input, part(input, "track"));
    const start = await pointAlong(input, length * 0.7);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(input).toHaveValue("70");
    await expect(input).toBeFocused();
    expect(await handleAt(input)).toBeCloseTo(length * 0.7, 0);
    // Pressed, the handle narrows to 2px
    await expect(part(input, "handle")).toHaveCSS("width", "2px");

    const next = await pointAlong(input, length * 0.55);
    await page.mouse.move(next.x, next.y, { steps: 4 });
    await expect(input).toHaveValue("55");
    // Past the end, it stays at the end
    const past = await pointAlong(input, length + 40);
    await page.mouse.move(past.x, past.y);
    await expect(input).toHaveValue("100");
    await expect(input).toHaveAttribute("data-changes", "0");
    await page.mouse.up();
    await expect(input).toHaveAttribute("data-changes", "1");
    expect(Number(await input.getAttribute("data-inputs"))).toBeGreaterThan(2);
    await expect(part(input, "handle")).toHaveCSS("width", "4px");
    // A pointer press doesn't show the focus ring
    await expect(part(input, "handle")).toHaveCSS("box-shadow", "none");
  });

  test("with stops, the pointer snaps the handle to the nearest stop", async ({
    page,
  }) => {
    const input = slider(page, "stops", "Every 10");
    const { length } = await along(input, part(input, "track"));
    const point = await pointAlong(input, 6 + (length - 12) * 0.56);
    await page.mouse.click(point.x, point.y);
    await expect(input).toHaveValue("60");
    const end = await pointAlong(input, length - 3);
    await page.mouse.click(end.x, end.y);
    await expect(input).toHaveValue("100");
  });

  test("the value indicator shows the value while pressed, above the handle", async ({
    page,
  }) => {
    const input = slider(page, "value-indicator", "Volume");
    const indicator = part(input, "value-indicator");
    const value = part(input, "value");
    await expect(indicator).toHaveCSS("opacity", "0");
    await expect(value).toHaveText("40");

    const { length } = await along(input, part(input, "track"));
    const point = await pointAlong(input, length * 0.8);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await expect(indicator).toHaveCSS("opacity", "1");
    await expect(value).toHaveText("80");

    // M3's 48x44 container in inverse-surface, 12px above the handle, centered on it
    const label = await box(value);
    const handle = await box(part(input, "handle-position"));
    expect([label.width, label.height]).toEqual([48, 44]);
    expect(handle.y - (label.y + label.height)).toBeCloseTo(12);
    expect(label.x + label.width / 2).toBeCloseTo(handle.x + handle.width / 2);
    await expect(value).toHaveCSS(
      "background-color",
      await colorRole(page, "inverse-surface")
    );
    await expect(value).toHaveCSS(
      "color",
      await colorRole(page, "inverse-on-surface")
    );
    await expect(value).toHaveCSS("font-size", "14px");
    await expect(value).toHaveCSS("line-height", "20px");
    await expect(value).toHaveCSS("font-weight", "500");
    expect(
      parseFloat(await css(value, "border-top-left-radius"))
    ).toBeGreaterThanOrEqual(22);

    await page.mouse.up();
    await expect(indicator).toHaveCSS("opacity", "0");
  });

  test("keyboard: arrows move a step, Page Up and Down or Space and an arrow a larger interval, Home and End the ends", async ({
    page,
  }) => {
    const input = slider(page, "values", "At 30");
    await input.focus();
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("31");
    await page.keyboard.press("ArrowUp");
    await expect(input).toHaveValue("32");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowDown");
    await expect(input).toHaveValue("30");
    await page.keyboard.press("PageUp");
    await expect(input).toHaveValue("40");
    await page.keyboard.press("PageDown");
    await expect(input).toHaveValue("30");

    await page.keyboard.down("Space");
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("40");
    await page.keyboard.up("Space");
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("41");

    await page.keyboard.press("End");
    await expect(input).toHaveValue("100");
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("100");
    await page.keyboard.press("Home");
    await expect(input).toHaveValue("0");
    const { length } = await along(input, part(input, "track"));
    expect(await handleAt(input)).toBeCloseTo(0, 0);
    await page.keyboard.press("End");
    expect(await handleAt(input)).toBeCloseTo(length, 0);
  });

  test("keyboard: with stops, an arrow moves one stop, and the handle moves over it", async ({
    page,
  }) => {
    const input = slider(page, "stops", "Every 10");
    await input.focus();
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("40");
    const { start, end } = await along(
      input,
      partIn(input, "active-track", "stop").nth(4)
    );
    expect(await handleAt(input)).toBeCloseTo((start + end) / 2, 0);

    // With Space held too, as M3's table asks: one stop
    await page.keyboard.down("Space");
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("50");
    await page.keyboard.up("Space");
  });

  test("focused from the keyboard: the focus ring around the narrowed handle, and the value indicator", async ({
    page,
  }) => {
    const input = slider(page, "value-indicator", "Volume");
    await page.keyboard.press("Tab");
    await input.focus();
    await page.keyboard.press("ArrowRight");
    await expectFocusRing(part(input, "handle"));
    await expect(part(input, "handle")).toHaveCSS("width", "2px");
    await expect(part(input, "value-indicator")).toHaveCSS("opacity", "1");
    await expect(part(input, "value")).toHaveText("41");
  });

  test("inset icon: M3's size, its padding in from the active track's start while it fits there", async ({
    page,
  }) => {
    for (const [name, size, padding] of [
      ["Brightness, medium", 24, 6],
      ["Brightness, extra large", 32, 8],
    ] as const) {
      const input = slider(page, "icon", name);
      const icon = partIn(input, "active-track", "icon");
      const iconBox = await box(icon);
      expect([iconBox.width, iconBox.height]).toEqual([size, size]);
      expect((await along(input, icon)).start).toBeCloseTo(padding, 0);
      const track = await box(part(input, "track"));
      expect(iconBox.y + size / 2).toBeCloseTo(track.y + track.height / 2);
      expect(await showsIn(icon, part(input, "active-track"))).toBe(true);
      expect(
        await showsIn(
          partIn(input, "inactive-track", "icon"),
          part(input, "inactive-track")
        )
      ).toBe(false);
      await expect(icon).toHaveCSS("fill", await colorRole(page, "on-primary"));
    }
  });

  test("inset icon: on the inactive track, its padding past the handle's gap, when the active track is too short", async ({
    page,
  }) => {
    const input = slider(page, "icon", "Brightness, large, low");
    const icon = partIn(input, "inactive-track", "icon");
    expect(await showsIn(icon, part(input, "inactive-track"))).toBe(true);
    expect(
      await showsIn(
        partIn(input, "active-track", "icon"),
        part(input, "active-track")
      )
    ).toBe(false);
    const at = await handleAt(input);
    expect((await along(input, icon)).start).toBeCloseTo(at + 8 + 6, 0);
    await expect(icon).toHaveCSS(
      "fill",
      await colorRole(page, "on-secondary-container")
    );

    // Dragged up, it moves to the active track
    const { length } = await along(input, part(input, "track"));
    const point = await pointAlong(input, length * 0.5);
    await page.mouse.click(point.x, point.y);
    expect(
      await showsIn(
        partIn(input, "active-track", "icon"),
        part(input, "active-track")
      )
    ).toBe(true);
  });

  test("disabled: M3's disabled colors, and neither pointer nor keys change it", async ({
    page,
  }) => {
    const input = slider(page, "disabled", "Disabled");
    await expect(input).toBeDisabled();
    await expect(part(input, "handle")).toHaveCSS(
      "background-color",
      await roleAt(page, "on-surface", 38)
    );
    await expect(part(input, "active-track")).toHaveCSS(
      "background-color",
      await roleAt(page, "on-surface", 38)
    );
    await expect(part(input, "inactive-track")).toHaveCSS(
      "background-color",
      await roleAt(page, "on-surface", 12)
    );
    await expect(partIn(input, "active-track", "stop").first()).toHaveCSS(
      "background-color",
      await colorRole(page, "inverse-on-surface")
    );
    await expect(partIn(input, "inactive-track", "stop").first()).toHaveCSS(
      "background-color",
      await roleAt(page, "on-surface", 38)
    );
    await expect(root(input)).toHaveCSS("cursor", "default");

    const { length } = await along(input, part(input, "track"));
    const point = await pointAlong(input, length * 0.9);
    await page.mouse.click(point.x, point.y);
    await expect(input).toHaveValue("40");
    await expect(input).not.toBeFocused();
  });

  test("works in a native form: submits its value, and a reset draws its first value again", async ({
    page,
  }) => {
    const input = slider(page, "form", "Volume");
    const form = section(page, "form").locator("form");
    const value = () =>
      form.evaluate((el: HTMLFormElement) => new FormData(el).get("volume"));
    expect(await value()).toBe("20");
    await input.focus();
    await page.keyboard.press("End");
    expect(await value()).toBe("100");
    await form.getByRole("button", { name: "Reset" }).click();
    await expect(input).toHaveValue("20");
    const { length } = await along(input, part(input, "track"));
    await expect.poll(() => handleAt(input)).toBeCloseTo(length * 0.2, 0);
  });

  test("mirrors right to left: the track starts at the right, and the arrows follow it", async ({
    page,
  }) => {
    const input = slider(page, "rtl", "Right to left");
    const { length } = await along(input, part(input, "track"), true);
    expect(await handleAt(input, true)).toBeCloseTo(length * 0.3, 0);
    const active = await along(input, part(input, "active-track"), true);
    expect(active.start).toBe(0);
    await expect(part(input, "active-track")).toHaveCSS(
      "border-top-right-radius",
      "8px"
    );

    await input.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(input).toHaveValue("31");
    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("30");

    const point = await pointAlong(input, length * 0.75, true);
    await page.mouse.click(point.x, point.y);
    await expect(input).toHaveValue("75");

    // The icon starts at the right too
    const withIcon = slider(page, "rtl", "Right to left with stops");
    const icon = partIn(withIcon, "active-track", "icon");
    expect((await along(withIcon, icon, true)).start).toBeCloseTo(6, 0);
  });

  test("vertical: the track runs up from the bottom, and a press sets the value from it", async ({
    page,
  }) => {
    const input = slider(page, "vertical", "Vertical");
    await root(input).scrollIntoViewIfNeeded();
    const slide = await box(root(input));
    const track = await box(part(input, "track"));
    const handle = await box(part(input, "handle"));
    // 300px tall by default, 48px wide around a 16px track and a 44x4 handle lying across it
    expect([slide.width, slide.height]).toEqual([48, 300]);
    expect(track.width).toBe(16);
    expect(track.height).toBe(296);
    expect([handle.width, handle.height]).toEqual([44, 4]);

    const center = handle.y + handle.height / 2;
    expect(track.y + track.height - center).toBeCloseTo(track.height * 0.25, 0);
    const active = await box(part(input, "active-track"));
    expect(active.y + active.height).toBeCloseTo(track.y + track.height, 0);
    await expect(part(input, "active-track")).toHaveCSS(
      "border-bottom-left-radius",
      "8px"
    );

    await page.mouse.click(
      track.x + track.width / 2,
      track.y + track.height * 0.4
    );
    await expect(input).toHaveValue("60");
    await page.keyboard.press("ArrowUp");
    await expect(input).toHaveValue("61");

    // The value indicator sits beside the handle, on the side the text starts from
    const withStops = slider(page, "vertical", "Vertical with stops");
    await withStops.focus();
    await page.keyboard.press("ArrowUp");
    await expect(withStops).toHaveValue("80");
    const label = await box(part(withStops, "value"));
    const position = await box(part(withStops, "handle-position"));
    expect(position.x - (label.x + label.width)).toBeCloseTo(12);
    expect(label.y + label.height / 2).toBeCloseTo(
      position.y + position.height / 2
    );
  });

  // ADR-0018: size on fast spatial; color and opacity on fast effects
  test("the handle narrows on fast spatial; colors and the value indicator change on fast effects", async ({
    page,
  }) => {
    const input = slider(page, "value-indicator", "Volume");
    const timing = async (target: Locator, property: string) => {
      const properties = (await css(target, "transition-property")).split(", ");
      const index = properties.indexOf(property);
      expect(index, `${property} transitions`).toBeGreaterThanOrEqual(0);
      const durations = (await css(target, "transition-duration")).split(", ");
      const easings = (await css(target, "transition-timing-function")).split(
        /,\s(?![^(]*\))/
      );
      return {
        duration: parseFloat(durations[index % durations.length]!) * 1000,
        easing: easings[index % easings.length],
      };
    };
    const token = async (name: string) => ({
      duration: parseFloat(
        await css(page.locator("html"), `--theme-duration-spring-${name}`)
      ),
      easing: await resolvedEasing(page, `--ease-spring-${name}`),
    });
    const spatial = await token("fast-spatial");
    const effects = await token("fast-effects");
    expect(await timing(part(input, "handle"), "inline-size")).toEqual(spatial);
    expect(await timing(part(input, "handle"), "background-color")).toEqual(
      effects
    );
    expect(await timing(part(input, "value-indicator"), "opacity")).toEqual(
      effects
    );
    expect(
      await timing(part(input, "active-track"), "background-color")
    ).toEqual(effects);
    // The handle doesn't animate to a new value: it's where the pointer is
    expect(
      await css(part(input, "handle-position"), "transition-duration")
    ).toBe("0s");
  });

  test.describe("with reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("nothing transitions", async ({ page }) => {
      const input = slider(page, "value-indicator", "Volume");
      for (const name of [
        "handle",
        "value-indicator",
        "active-track",
        "inactive-track",
      ] as const) {
        expect(await css(part(input, name), "transition-duration")).toMatch(
          /^0s(, 0s)*$/
        );
      }
    });
  });
});

// Where a part's center is along the track
const centerAlong = async (input: Locator, target: Locator, isRtl = false) => {
  const { start, end } = await along(input, target, isRtl);
  return (start + end) / 2;
};

test.describe("Slider, centered", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/slider");
  });

  test("above the middle, the active track fills from the middle to 6px before the handle", async ({
    page,
  }) => {
    const input = slider(page, "centered", "Centered, above");
    const { length } = await along(input, part(input, "track"));
    const at = await handleAt(input);
    // 20 from -50 to 50
    expect(at).toBeCloseTo(length * 0.7, 0);

    const start = await along(input, part(input, "inactive-track-start"));
    const active = await along(input, part(input, "active-track"));
    const inactive = await along(input, part(input, "inactive-track"));
    expect(start.start).toBe(0);
    // The inactive track before the middle stops M3's 6px gap short of it
    expect(start.end).toBeCloseTo(length / 2 - 6, 0);
    expect(active.start).toBeCloseTo(length / 2, 0);
    expect(active.end).toBeCloseTo(at - 8, 0);
    expect(inactive.start).toBeCloseTo(at + 8, 0);
    expect(inactive.end).toBeCloseTo(length, 0);

    // The active track's corners are all 2px; each inactive track's outer one is M3's size
    for (const corner of ["border-top-left-radius", "border-top-right-radius"])
      await expect(part(input, "active-track")).toHaveCSS(corner, "2px");
    await expect(part(input, "inactive-track-start")).toHaveCSS(
      "border-top-left-radius",
      "8px"
    );
    await expect(part(input, "inactive-track-start")).toHaveCSS(
      "border-top-right-radius",
      "2px"
    );
    await expect(part(input, "inactive-track")).toHaveCSS(
      "border-top-right-radius",
      "8px"
    );
  });

  test("below the middle, the active track fills from 6px after the handle to the middle", async ({
    page,
  }) => {
    const input = slider(page, "centered", "Centered, below");
    const { length } = await along(input, part(input, "track"));
    const at = await handleAt(input);
    expect(at).toBeCloseTo(length * 0.2, 0);

    const start = await along(input, part(input, "inactive-track-start"));
    const active = await along(input, part(input, "active-track"));
    const inactive = await along(input, part(input, "inactive-track"));
    expect(start.end).toBeCloseTo(at - 8, 0);
    expect(active.start).toBeCloseTo(at + 8, 0);
    expect(active.end).toBeCloseTo(length / 2, 0);
    expect(inactive.start).toBeCloseTo(length / 2 + 6, 0);
  });

  test("at the middle, there's no active track, and the inactive tracks meet the handle's gaps", async ({
    page,
  }) => {
    const input = slider(page, "centered", "Centered, at the middle");
    await expect(input).toHaveValue("0");
    const { length } = await along(input, part(input, "track"));
    expect(await handleAt(input)).toBeCloseTo(length / 2, 0);
    expect((await box(part(input, "active-track"))).width).toBe(0);
    expect(
      (await along(input, part(input, "inactive-track-start"))).end
    ).toBeCloseTo(length / 2 - 8, 0);
    expect(
      (await along(input, part(input, "inactive-track"))).start
    ).toBeCloseTo(length / 2 + 8, 0);
  });

  test("a stop indicator at each end, 4px in from it", async ({ page }) => {
    const input = slider(page, "centered", "Centered, above");
    const first = partIn(input, "inactive-track-start", "stop").first();
    const last = partIn(input, "inactive-track", "stop").last();
    const { length } = await along(input, part(input, "track"));
    expect((await along(input, first)).start).toBeCloseTo(4, 0);
    expect(length - (await along(input, last)).end).toBeCloseTo(4, 0);
    expect(await showsIn(first, part(input, "inactive-track-start"))).toBe(
      true
    );
    expect(await showsIn(last, part(input, "inactive-track"))).toBe(true);
    for (const stop of [first, last])
      await expect(stop).toHaveCSS(
        "background-color",
        await colorRole(page, "on-secondary-container")
      );

    await expect(
      part(slider(page, "centered", "Centered without stop indicators"), "stop")
    ).toHaveCount(0);
  });

  test("stops: each shows in the track that holds it, and none at the middle, which the gap covers", async ({
    page,
  }) => {
    const input = slider(page, "centered", "Centered with stops");
    const { length } = await along(input, part(input, "track"));
    // -50 to 50 every 10, less the one at 0
    const tracks = [
      "inactive-track-start",
      "active-track",
      "inactive-track",
    ] as const;
    for (const track of tracks)
      await expect(partIn(input, track, "stop")).toHaveCount(10);
    const fractions = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10].map((i) => i / 10);
    const shown = await Promise.all(
      fractions.map(async (fraction, i) => {
        const center = await centerAlong(
          input,
          partIn(input, "active-track", "stop").nth(i)
        );
        expect(center).toBeCloseTo(6 + (length - 12) * fraction, 0);
        for (const track of tracks)
          if (
            await showsIn(
              partIn(input, track, "stop").nth(i),
              part(input, track)
            )
          )
            return track;
        return "none";
      })
    );
    // 20 is the seventh stop: the handle's gap hides it, and the active track holds the one at 10
    expect(shown).toEqual([
      "inactive-track-start",
      "inactive-track-start",
      "inactive-track-start",
      "inactive-track-start",
      "inactive-track-start",
      "active-track",
      "none",
      "inactive-track",
      "inactive-track",
      "inactive-track",
    ]);
    await expect(partIn(input, "active-track", "stop").nth(5)).toHaveCSS(
      "background-color",
      await colorRole(page, "on-primary")
    );
  });

  test("stops: with an odd number of intervals, no stop is at the middle, so every one is drawn", async ({
    page,
  }) => {
    const input = slider(page, "centered", "Centered, odd stops");
    // -5 to 5 every 2: -5, -3, -1, 1, 3, 5
    const stops = partIn(input, "active-track", "stop");
    await expect(stops).toHaveCount(6);
    const { length } = await along(input, part(input, "track"));
    // At 1, the fourth stop, the active track runs from the middle to the handle's gap
    expect(await handleAt(input)).toBeCloseTo(
      await centerAlong(input, stops.nth(3)),
      0
    );
    expect((await along(input, part(input, "active-track"))).start).toBeCloseTo(
      length / 2,
      0
    );
    // The stops either side of the middle each show, in their own track
    expect(
      await showsIn(
        partIn(input, "inactive-track-start", "stop").nth(2),
        part(input, "inactive-track-start")
      )
    ).toBe(true);
    expect(
      await showsIn(
        partIn(input, "inactive-track", "stop").nth(4),
        part(input, "inactive-track")
      )
    ).toBe(true);
  });

  test("the pointer and keys move its one handle, across the middle", async ({
    page,
  }) => {
    const input = slider(page, "centered", "Centered, above");
    const { length } = await along(input, part(input, "track"));
    const point = await pointAlong(input, length * 0.3);
    await page.mouse.click(point.x, point.y);
    await expect(input).toHaveValue("-20");
    await expect(input).toBeFocused();
    expect(await handleAt(input)).toBeCloseTo(length * 0.3, 0);
    expect((await along(input, part(input, "active-track"))).end).toBeCloseTo(
      length / 2,
      0
    );
    await page.keyboard.press("End");
    await expect(input).toHaveValue("50");
    expect((await box(part(input, "inactive-track"))).width).toBe(0);
    await page.keyboard.press("Home");
    await expect(input).toHaveValue("-50");
    expect((await box(part(input, "inactive-track-start"))).width).toBe(0);
  });

  test("the value indicator shows its value, negative too", async ({
    page,
  }) => {
    const input = slider(page, "centered", "Centered with stops");
    await input.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Home");
    await expect(handlePart(input, "value-indicator")).toHaveCSS(
      "opacity",
      "1"
    );
    await expect(handlePart(input, "value")).toHaveText("-50");
  });

  test("vertical: it fills from the middle, up or down", async ({ page }) => {
    const input = slider(page, "centered", "Centered, vertical");
    await root(input).scrollIntoViewIfNeeded();
    const track = await box(part(input, "track"));
    const handle = await box(part(input, "handle"));
    // -25: a quarter of the way up
    expect(track.y + track.height - (handle.y + handle.height / 2)).toBeCloseTo(
      track.height * 0.25,
      0
    );
    const active = await box(part(input, "active-track"));
    expect(active.y).toBeCloseTo(track.y + track.height / 2, 0);
    expect(active.y + active.height).toBeCloseTo(
      handle.y + handle.height / 2 - 8,
      0
    );
  });

  test("mirrors right to left: it fills from the middle towards the left", async ({
    page,
  }) => {
    const input = slider(page, "rtl", "Centered, right to left");
    const { length } = await along(input, part(input, "track"), true);
    const at = await handleAt(input, true);
    expect(at).toBeCloseTo(length * 0.7, 0);
    const active = await along(input, part(input, "active-track"), true);
    expect(active.start).toBeCloseTo(length / 2, 0);
    expect(active.end).toBeCloseTo(at - 8, 0);
    await expect(part(input, "inactive-track-start")).toHaveCSS(
      "border-top-right-radius",
      "8px"
    );
  });
});

test.describe("Slider, centered and range sizes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/slider");
  });

  for (const [size, thickness, handle, corner] of [
    ["small", 24, 44, 8],
    ["large", 56, 68, 16],
    ["extra large", 96, 108, 28],
  ] as const) {
    test(`matches M3's measurements: ${size}`, async ({ page }) => {
      for (const inputs of [
        [slider(page, "variant-sizes", `Centered, ${size}`)],
        [
          slider(page, "variant-sizes", `Range start, ${size}`),
          slider(page, "variant-sizes", `Range end, ${size}`),
        ],
      ]) {
        const first = inputs[0]!;
        expect((await box(part(first, "track"))).height).toBe(thickness);
        for (const input of inputs) {
          const handleBox = await box(handlePart(input, "handle"));
          expect([handleBox.width, handleBox.height]).toEqual([4, handle]);
        }
        // The outer corners are M3's size; the ones beside a handle or the middle 2px
        await expect(part(first, "inactive-track-start")).toHaveCSS(
          "border-top-left-radius",
          `${corner}px`
        );
        await expect(part(first, "inactive-track")).toHaveCSS(
          "border-top-right-radius",
          `${corner}px`
        );
        await expect(part(first, "active-track")).toHaveCSS(
          "border-top-left-radius",
          "2px"
        );
      }
    });
  }
});

test.describe("Slider, range", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/slider");
  });

  test("two native range inputs, each with its own name and value, from the minimum and maximum unless given", async ({
    page,
  }) => {
    const start = slider(page, "range", "Minimum");
    const end = slider(page, "range", "Maximum");
    await expect(start).toHaveAttribute("type", "range");
    await expect(end).toHaveAttribute("type", "range");
    await expect(start).toHaveValue("20");
    await expect(end).toHaveValue("60");
    expect(
      await root(start).evaluate(
        (el, other) => el === other,
        await root(end).elementHandle()
      )
    ).toBe(true);
    await expect(slider(page, "range", "Lowest")).toHaveValue("0");
    await expect(slider(page, "range", "Highest")).toHaveValue("100");
    // Each handle's value indicator repeats its value, hidden from assistive tech
    await expect(
      handlePart(slider(page, "range", "From"), "value")
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("the active track runs between the handles, with M3's 6px gap to each, and the inactive tracks outside them", async ({
    page,
  }) => {
    const start = slider(page, "range", "Minimum");
    const end = slider(page, "range", "Maximum");
    const { length } = await along(start, part(start, "track"));
    const from = await centerAlong(start, handlePart(start, "handle-position"));
    const to = await centerAlong(end, handlePart(end, "handle-position"));
    expect(from).toBeCloseTo(length * 0.2, 0);
    expect(to).toBeCloseTo(length * 0.6, 0);

    const before = await along(start, part(start, "inactive-track-start"));
    const active = await along(start, part(start, "active-track"));
    const after = await along(start, part(start, "inactive-track"));
    expect(before.start).toBe(0);
    expect(before.end).toBeCloseTo(from - 8, 0);
    expect(active.start).toBeCloseTo(from + 8, 0);
    expect(active.end).toBeCloseTo(to - 8, 0);
    expect(after.start).toBeCloseTo(to + 8, 0);
    expect(after.end).toBeCloseTo(length, 0);
    for (const corner of ["border-top-left-radius", "border-top-right-radius"])
      await expect(part(start, "active-track")).toHaveCSS(corner, "2px");
    await expect(part(start, "inactive-track-start")).toHaveCSS(
      "border-top-left-radius",
      "8px"
    );

    // A stop indicator at each end
    expect(
      await showsIn(
        partIn(start, "inactive-track-start", "stop").first(),
        part(start, "inactive-track-start")
      )
    ).toBe(true);
    expect(
      await showsIn(
        partIn(start, "inactive-track", "stop").last(),
        part(start, "inactive-track")
      )
    ).toBe(true);
  });

  test("a press moves the nearer handle there, and dragging it stops at the other", async ({
    page,
  }) => {
    const start = slider(page, "range", "Minimum");
    const end = slider(page, "range", "Maximum");
    await end.evaluate((el: HTMLInputElement) => {
      el.dataset.changes = "0";
      el.addEventListener("change", () => {
        el.dataset.changes = String(Number(el.dataset.changes) + 1);
      });
    });
    const { length } = await along(start, part(start, "track"));

    // 45 is nearer 60 than 20
    const near = await pointAlong(start, length * 0.45);
    await page.mouse.move(near.x, near.y);
    await page.mouse.down();
    await expect(end).toHaveValue("45");
    await expect(start).toHaveValue("20");
    await expect(end).toBeFocused();
    await expect(handlePart(end, "handle")).toHaveCSS("width", "2px");
    await expect(handlePart(start, "handle")).toHaveCSS("width", "4px");
    // Dragged below the start, it stops at it
    const below = await pointAlong(start, length * 0.1);
    await page.mouse.move(below.x, below.y, { steps: 4 });
    await expect(end).toHaveValue("20");
    await expect(start).toHaveValue("20");
    await page.mouse.up();
    await expect(end).toHaveAttribute("data-changes", "1");

    // From the same place, a press below the handles moves the start one
    const low = await pointAlong(start, length * 0.05);
    await page.mouse.click(low.x, low.y);
    await expect(start).toHaveValue("5");
    await expect(end).toHaveValue("20");
    await expect(start).toBeFocused();
  });

  test("with both handles at one value, a drag moves the one on the side it goes", async ({
    page,
  }) => {
    const start = slider(page, "range", "Minimum");
    const end = slider(page, "range", "Maximum");
    await start.evaluate((el: HTMLInputElement) => {
      el.value = "40";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await end.evaluate((el: HTMLInputElement) => {
      el.value = "40";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const { length } = await along(start, part(start, "track"));
    const at = await pointAlong(start, length * 0.4);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    const up = await pointAlong(start, length * 0.7);
    await page.mouse.move(up.x, up.y, { steps: 4 });
    await page.mouse.up();
    await expect(end).toHaveValue("70");
    await expect(start).toHaveValue("40");

    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    const down = await pointAlong(start, length * 0.1);
    await page.mouse.move(down.x, down.y, { steps: 4 });
    await page.mouse.up();
    await expect(start).toHaveValue("10");
  });

  test("keyboard: Tab goes from the start handle to the end one, and neither passes the other", async ({
    page,
  }) => {
    const start = slider(page, "range", "Minimum");
    const end = slider(page, "range", "Maximum");
    await start.focus();
    await page.keyboard.press("ArrowRight");
    await expect(start).toHaveValue("21");
    await page.keyboard.press("End");
    await expect(start).toHaveValue("60");
    await page.keyboard.press("ArrowRight");
    await expect(start).toHaveValue("60");
    await page.keyboard.press("Home");
    await expect(start).toHaveValue("0");

    await page.keyboard.press("Tab");
    await expect(end).toBeFocused();
    await page.keyboard.press("Home");
    await expect(end).toHaveValue("0");
    await page.keyboard.press("End");
    await expect(end).toHaveValue("100");
  });

  test("a value set past the other handle, as by assistive tech, stops at it", async ({
    page,
  }) => {
    const start = slider(page, "range", "Minimum");
    await start.evaluate((el: HTMLInputElement) => {
      el.value = "90";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(start).toHaveValue("60");
  });

  test("the value indicator and focus ring show on the focused or pressed handle only", async ({
    page,
  }) => {
    const start = slider(page, "range", "From");
    const end = slider(page, "range", "To");
    await start.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(start).toBeFocused();
    await expectFocusRing(handlePart(start, "handle"));
    await expect(handlePart(end, "handle")).toHaveCSS("box-shadow", "none");
    await expect(handlePart(start, "value-indicator")).toHaveCSS(
      "opacity",
      "1"
    );
    await expect(handlePart(end, "value-indicator")).toHaveCSS("opacity", "0");
    await expect(handlePart(start, "value")).toHaveText("30");
    await page.keyboard.press("ArrowRight");
    // With stops, one stop
    await expect(handlePart(start, "value")).toHaveText("40");

    const { length } = await along(end, part(end, "track"));
    const point = await pointAlong(end, 6 + (length - 12) * 0.81);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await expect(end).toHaveValue("80");
    await expect(handlePart(end, "value-indicator")).toHaveCSS("opacity", "1");
    await expect(handlePart(start, "value-indicator")).toHaveCSS(
      "opacity",
      "0"
    );
    await page.mouse.up();
  });

  test("stops: on-primary between the handles, on-secondary-container outside them", async ({
    page,
  }) => {
    const input = slider(page, "range", "From");
    // 30 to 70 every 10: the stops at 40 to 60 are on the active track
    const shownIn = async (i: number) => {
      for (const track of [
        "inactive-track-start",
        "active-track",
        "inactive-track",
      ] as const)
        if (
          await showsIn(partIn(input, track, "stop").nth(i), part(input, track))
        )
          return track;
      return "none";
    };
    const shown = await Promise.all(
      Array.from({ length: 11 }, (_, i) => shownIn(i))
    );
    expect(shown).toEqual([
      "inactive-track-start",
      "inactive-track-start",
      "inactive-track-start",
      "none",
      "active-track",
      "active-track",
      "active-track",
      "none",
      "inactive-track",
      "inactive-track",
      "inactive-track",
    ]);
  });

  test("disabled: both handles, in M3's disabled colors", async ({ page }) => {
    const start = slider(page, "range", "Disabled start");
    const end = slider(page, "range", "Disabled end");
    await expect(start).toBeDisabled();
    await expect(end).toBeDisabled();
    for (const input of [start, end])
      await expect(handlePart(input, "handle")).toHaveCSS(
        "background-color",
        await roleAt(page, "on-surface", 38)
      );
    await expect(part(start, "active-track")).toHaveCSS(
      "background-color",
      await roleAt(page, "on-surface", 38)
    );
    for (const track of ["inactive-track-start", "inactive-track"] as const)
      await expect(part(start, track)).toHaveCSS(
        "background-color",
        await roleAt(page, "on-surface", 12)
      );
    await expect(
      partIn(start, "inactive-track-start", "stop").first()
    ).toHaveCSS("background-color", await roleAt(page, "on-surface", 38));

    const { length } = await along(start, part(start, "track"));
    const point = await pointAlong(start, length * 0.9);
    await page.mouse.click(point.x, point.y);
    await expect(end).toHaveValue("60");
  });

  test("works in a native form: submits both values, and a reset draws them again", async ({
    page,
  }) => {
    const start = slider(page, "range", "Minimum price");
    const end = slider(page, "range", "Maximum price");
    await expect(start).toHaveAccessibleDescription("Price");
    const form = section(page, "range").locator("form");
    const values = () =>
      form.evaluate((el: HTMLFormElement) => {
        const data = new FormData(el);
        return [data.get("min-price"), data.get("max-price")];
      });
    expect(await values()).toEqual(["10", "90"]);
    await end.focus();
    await page.keyboard.press("Home");
    expect(await values()).toEqual(["10", "10"]);
    await form.getByRole("button", { name: "Reset" }).click();
    await expect(end).toHaveValue("90");
    const { length } = await along(end, part(end, "track"));
    await expect
      .poll(() => centerAlong(end, handlePart(end, "handle-position")))
      .toBeCloseTo(length * 0.9, 0);
  });

  test("mirrors right to left: the start handle is on the right, and the arrows follow the track", async ({
    page,
  }) => {
    const start = slider(page, "rtl", "Range start, right to left");
    const { length } = await along(start, part(start, "track"), true);
    expect(
      await centerAlong(start, handlePart(start, "handle-position"), true)
    ).toBeCloseTo(length * 0.2, 0);
    expect(
      (await along(start, part(start, "inactive-track-start"), true)).start
    ).toBe(0);
    await start.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(start).toHaveValue("21");
  });

  test("vertical: the start handle is the lower one", async ({ page }) => {
    const start = slider(page, "range", "Vertical start");
    const end = slider(page, "range", "Vertical end");
    await root(start).scrollIntoViewIfNeeded();
    await expect(start).toHaveAttribute("aria-orientation", "vertical");
    const track = await box(part(start, "track"));
    const low = await box(handlePart(start, "handle"));
    const high = await box(handlePart(end, "handle"));
    expect(track.y + track.height - (low.y + low.height / 2)).toBeCloseTo(
      track.height * 0.25,
      0
    );
    expect(track.y + track.height - (high.y + high.height / 2)).toBeCloseTo(
      track.height * 0.75,
      0
    );
    await page.mouse.click(
      track.x + track.width / 2,
      track.y + track.height * 0.1
    );
    await expect(end).toHaveValue("90");
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
