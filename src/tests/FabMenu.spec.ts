import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import {
  box,
  expectFocusRing,
  resolvedColor,
  settled,
  textBox,
} from "./support/helpers";

// Each case on /tests/fab-menu is a Section with data-testid="fab-menu-<caseId>" holding one
// FabMenu. Its FAB's accessible name is the menu's `label` ("Create" in every case); each item's
// is its own `label`.
type FabMenuCaseId =
  | "no-props"
  | "secondary"
  | "tertiary"
  | "align-start"
  | "align-end"
  | "md"
  | "lg"
  | "six-items";

const menuCase = (page: Page, caseId: FabMenuCaseId) =>
  page.getByTestId(`fab-menu-${caseId}`);
const fab = (page: Page, caseId: FabMenuCaseId) =>
  menuCase(page, caseId).getByRole("button", { name: "Create", exact: true });
const item = (page: Page, caseId: FabMenuCaseId, name: string) =>
  menuCase(page, caseId).getByRole("button", { name, exact: true });
const items = (page: Page, caseId: FabMenuCaseId) =>
  menuCase(page, caseId).locator("[popover]");

const color = (target: Locator, property: "background-color" | "color") =>
  target.evaluate(
    (el, p) => getComputedStyle(el).getPropertyValue(p),
    property
  );

const shadow = (target: Locator) =>
  target.evaluate((el) => getComputedStyle(el).boxShadow);

/** M3's elevation level 3, as the theme's token resolves on the page. */
const elevation3 = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.boxShadow = "var(--shadow-theme-elevation-3)";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).boxShadow;
    probe.remove();
    return resolved;
  });

/** Opens a case's menu and waits for its items and close button to come to rest. */
const open = async (page: Page, caseId: FabMenuCaseId) => {
  await fab(page, caseId).click();
  await expect(items(page, caseId)).toBeVisible();
  await settled(page);
};

test.describe("FabMenu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fab-menu");
  });

  test("the FAB opens and closes its items, which are hidden while closed", async ({
    page,
  }) => {
    const toggle = fab(page, "no-props");

    await expect(item(page, "no-props", "Email")).toBeHidden();
    await toggle.click();
    for (const name of ["Email", "Message", "Folder"]) {
      await expect(item(page, "no-props", name)).toBeVisible();
    }
    await toggle.click();
    await expect(items(page, "no-props")).toBeHidden();
  });

  // The FAB's expanded state comes from being the popover's invoker, not from an aria-expanded
  // attribute, so Playwright's toBeExpanded() (which reads the attribute) can't see it. Chromium's
  // own accessibility tree can be read over CDP; Firefox's and WebKit's can't be from Playwright.
  test("the FAB reports collapsed, then expanded, to assistive tech", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "reads Chromium's accessibility tree"
    );
    const cdp = await page.context().newCDPSession(page);
    const expanded = async () => {
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const node = nodes.find(
        (n) => n.role?.value === "button" && n.name?.value === "Create"
      );
      return node?.properties?.find((p) => p.name === "expanded")?.value.value;
    };

    expect(await expanded()).toBe(false);
    await fab(page, "no-props").click();
    await expect.poll(expanded).toBe(true);
    await page.keyboard.press("Escape");
    await expect.poll(expanded).toBe(false);
  });

  test("Tab from the open FAB goes through the items, top first", async ({
    page,
  }) => {
    await fab(page, "no-props").focus();
    await page.keyboard.press("Enter");

    for (const name of ["Email", "Message", "Folder"]) {
      await page.keyboard.press("Tab");
      await expect(item(page, "no-props", name)).toBeFocused();
    }
  });

  test("Down from the open FAB moves to the top item", async ({ page }) => {
    await fab(page, "no-props").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");

    await expect(item(page, "no-props", "Email")).toBeFocused();
  });

  test("Down from the closed FAB does nothing", async ({ page }) => {
    await fab(page, "no-props").focus();
    await page.keyboard.press("ArrowDown");

    await expect(fab(page, "no-props")).toBeFocused();
    await expect(items(page, "no-props")).toBeHidden();
  });

  test("Escape closes it and returns focus to the FAB", async ({ page }) => {
    await fab(page, "no-props").click();
    await item(page, "no-props", "Message").focus();
    await page.keyboard.press("Escape");

    await expect(items(page, "no-props")).toBeHidden();
    await expect(fab(page, "no-props")).toBeFocused();
  });

  test("a click outside closes it, returning focus to the FAB from an item", async ({
    page,
  }) => {
    await fab(page, "no-props").click();
    await item(page, "no-props", "Message").focus();
    await page.getByRole("heading", { name: "FabMenu Tests" }).click();

    await expect(items(page, "no-props")).toBeHidden();
    await expect(fab(page, "no-props")).toBeFocused();
  });

  test("choosing an item closes it after the item's own handler, returning focus to the FAB", async ({
    page,
  }) => {
    await fab(page, "no-props").click();
    const message = item(page, "no-props", "Message");
    // the item's own handler runs while the menu is still open
    await message.evaluate((el) =>
      el.addEventListener("click", () => {
        el.dataset.clickedWhileOpen = String(
          el.closest("[popover]")!.matches(":popover-open")
        );
      })
    );
    await message.focus();
    await page.keyboard.press("Enter");

    await expect(
      menuCase(page, "no-props").getByRole("button", {
        name: "Message",
        includeHidden: true,
      })
    ).toHaveAttribute("data-clicked-while-open", "true");
    await expect(items(page, "no-props")).toBeHidden();
    await expect(fab(page, "no-props")).toBeFocused();
  });

  test("items have M3's metrics: 56px, 24px padding, an 8px icon-label gap, 4px apart, 8px above the close button", async ({
    page,
  }) => {
    await open(page, "no-props");
    const boxes = [];

    for (const name of ["Email", "Message", "Folder"]) {
      const itemBox = await box(item(page, "no-props", name));
      boxes.push(itemBox);
      const icon = await box(item(page, "no-props", name).locator("svg"));
      expect(itemBox.height).toBe(56);
      expect(icon.width).toBe(24);
      expect(icon.x - itemBox.x).toBe(24);
      const label = await textBox(item(page, "no-props", name));
      expect(label.x - (icon.x + icon.width)).toBeCloseTo(8, 0);
      expect(itemBox.x + itemBox.width - (label.x + label.width)).toBeCloseTo(
        24,
        0
      );
    }
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.y - (boxes[i - 1]!.y + boxes[i - 1]!.height)).toBe(4);
    }
    const fabBox = await box(fab(page, "no-props"));
    const last = boxes.at(-1)!;
    expect(fabBox.y - (last.y + last.height)).toBe(8);
  });

  test("the items and the close button sit at elevation 3", async ({
    page,
  }) => {
    await open(page, "no-props");
    // off the close button, which rises to level 4 on hover
    await page.mouse.move(0, 0);
    const level3 = await elevation3(page);

    // Tailwind composes its (transparent) ring layers into the same box-shadow
    expect(await shadow(item(page, "no-props", "Email"))).toContain(level3);
    await expect.poll(() => shadow(fab(page, "no-props"))).toContain(level3);
  });

  test("open, the FAB is a 56px round close button with a 20px close icon", async ({
    page,
  }) => {
    await open(page, "no-props");
    const toggle = fab(page, "no-props");
    const fabBox = await box(toggle);

    expect({ width: fabBox.width, height: fabBox.height }).toEqual({
      width: 56,
      height: 56,
    });
    await expect(toggle).toHaveCSS("border-radius", "28px");
    // the FAB's own icon fades out; the close icon fades in
    const icons = toggle.locator("svg");
    await expect(icons.nth(0)).toHaveCSS("opacity", "0");
    await expect(icons.nth(1)).toHaveCSS("opacity", "1");
    const closeIcon = await box(icons.nth(1));
    expect(closeIcon.width).toBe(20);
    // the close icon is decorative: the FAB's name stays its label
    await expect(toggle).toHaveAccessibleName("Create");
  });

  test("a medium or large FAB shrinks into the 56px close button in its bottom corner", async ({
    page,
  }) => {
    const sides = { md: 80, lg: 96 } as const;

    for (const [caseId, side] of Object.entries(sides) as [
      "md" | "lg",
      number,
    ][]) {
      await fab(page, caseId).scrollIntoViewIfNeeded();
      const closed = await box(fab(page, caseId));
      expect(closed.width).toBe(side);
      expect(closed.height).toBe(side);

      await open(page, caseId);
      const opened = await box(fab(page, caseId));
      expect(opened.width).toBe(56);
      expect(opened.height).toBe(56);
      expect(opened.x + opened.width).toBe(closed.x + closed.width);
      expect(opened.y + opened.height).toBe(closed.y + closed.height);
      await page.keyboard.press("Escape");
    }
  });

  test("each color set puts the FAB and items on the container role, and the close button on the main role", async ({
    page,
  }) => {
    const cases = {
      "no-props": "primary",
      secondary: "secondary",
      tertiary: "tertiary",
    } as const;

    for (const [caseId, role] of Object.entries(cases) as [
      keyof typeof cases,
      string,
    ][]) {
      const toggle = fab(page, caseId);
      const container = await resolvedColor(
        page,
        `var(--theme-color-${role}-container)`
      );
      const onContainer = await resolvedColor(
        page,
        `var(--theme-color-on-${role}-container)`
      );

      expect(await color(toggle, "background-color")).toBe(container);
      expect(await color(toggle, "color")).toBe(onContainer);

      await open(page, caseId);
      expect(await color(toggle, "background-color")).toBe(
        await resolvedColor(page, `var(--theme-color-${role})`)
      );
      expect(await color(toggle, "color")).toBe(
        await resolvedColor(page, `var(--theme-color-on-${role})`)
      );
      const email = item(page, caseId, "Email");
      expect(await color(email, "background-color")).toBe(container);
      expect(await color(email, "color")).toBe(onContainer);
      await page.keyboard.press("Escape");
    }
  });

  test("items line up with the FAB's end edge by default, or its start edge", async ({
    page,
  }) => {
    await open(page, "align-end");
    const end = await box(fab(page, "align-end"));
    for (const name of ["Email", "A longer message"]) {
      const itemBox = await box(item(page, "align-end", name));
      expect(itemBox.x + itemBox.width).toBe(end.x + end.width);
    }
    await page.keyboard.press("Escape");

    await open(page, "align-start");
    const start = await box(fab(page, "align-start"));
    for (const name of ["Email", "A longer message"]) {
      expect((await box(item(page, "align-start", name))).x).toBe(start.x);
    }
  });

  test("takes up to six items", async ({ page }) => {
    await open(page, "six-items");
    await expect(items(page, "six-items").getByRole("button")).toHaveCount(6);
    for (const button of await items(page, "six-items")
      .getByRole("button")
      .all()) {
      await expect(button).toBeInViewport();
    }
  });

  test("items open one by one nearest the FAB first, and close from the top", async ({
    page,
  }) => {
    const delays = () =>
      items(page, "six-items")
        .locator("[data-ac-fab-menu-item]")
        .evaluateAll((els) =>
          els.map((el) => parseFloat(getComputedStyle(el).transitionDelay))
        );
    const closing = await delays();
    await fab(page, "six-items").click();
    const opening = await delays();

    // in DOM order, top to bottom: the bottom item, nearest the FAB, opens first
    expect(opening).toEqual([...opening].sort((a, b) => b - a));
    expect(closing).toEqual([...closing].sort((a, b) => a - b));
    expect(new Set(opening).size).toBe(6);
    expect(new Set(closing).size).toBe(6);
  });

  test("the FAB and the items show the focus ring", async ({ page }) => {
    await fab(page, "no-props").focus();
    await page.keyboard.press("Enter");
    await expectFocusRing(fab(page, "no-props"));

    await page.keyboard.press("Tab");
    await expectFocusRing(item(page, "no-props", "Email"));
  });

  test("with reduced motion, opening and closing are instant", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const email = item(page, "no-props", "Email");

    await fab(page, "no-props").click();
    await expect(items(page, "no-props")).toHaveCSS(
      "transition-duration",
      "0s"
    );
    await expect(email).toHaveCSS("transition-duration", "0s");
    await expect(fab(page, "no-props")).toHaveCSS("transition-duration", "0s");
    // at rest straight away, with no animation running
    expect(await email.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1"
    );
    await page.keyboard.press("Escape");
    expect(
      await items(page, "no-props").evaluate(
        (el) => getComputedStyle(el).display
      )
    ).toBe("none");
  });
});

// FabMenu takes 2 to 6 FabMenuItems, each a direct child. Anything else throws at render time;
// /tests/fab-menu-content renders each kind of content and lists what it rendered or the error it
// threw.
test.describe("FabMenu content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fab-menu-content");
  });

  const outcome = (page: Page, content: string) =>
    page.getByTestId(`fab-menu-content-${content}`);

  test("ignores comments between its items", async ({ page }) => {
    await expect(outcome(page, "comments")).toHaveText("rendered 2 items");
  });

  test("renders six items", async ({ page }) => {
    await expect(outcome(page, "six")).toHaveText("rendered 6 items");
  });

  test("throws with fewer than two items", async ({ page }) => {
    await expect(outcome(page, "one")).toHaveText(
      "FabMenu: expected 2 to 6 FabMenuItems, as M3 specifies, but found 1."
    );
  });

  test("throws with more than six items", async ({ page }) => {
    await expect(outcome(page, "seven")).toHaveText(
      "FabMenu: expected 2 to 6 FabMenuItems, as M3 specifies, but found 7."
    );
  });

  test("throws on an item wrapped in another element", async ({ page }) => {
    await expect(outcome(page, "wrapped")).toHaveText(
      /^FabMenu: found a FabMenuItem wrapped in <div>, .*direct child/
    );
  });

  test("throws on another element, naming it", async ({ page }) => {
    await expect(outcome(page, "element")).toHaveText(
      /^FabMenu: found <button>, but only FabMenuItem components can go in FabMenu/
    );
  });

  test("throws on text, quoting it", async ({ page }) => {
    await expect(outcome(page, "text")).toHaveText(
      /^FabMenu: found "Some stray words", /
    );
  });
});
