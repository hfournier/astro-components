import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { box, resolvedColor, settled } from "./support/helpers";

// Each case on /tests/text-field-chips is a Section with data-testid="text-field-chips-<caseId>".
// The labels case's field sets chipRemoveLabel and chipEditLabel, in French.
type CaseId =
  "wrap" | "empty" | "outlined" | "scroll" | "move" | "rtl" | "labels";

const section = (page: Page, caseId: CaseId) =>
  page.getByTestId(`text-field-chips-${caseId}`);

// A field in a case, by its label
const field = (page: Page, caseId: CaseId, label: string) =>
  section(page, caseId)
    .locator("[data-ac-text-field]")
    .filter({
      has: page.locator("[data-ac-text-field-part=label]", {
        hasText: new RegExp(`^${label}\\*?$`),
      }),
    });

const input = (target: Locator) =>
  target.locator("[data-ac-text-field-part=input]");

// The field's chips, and their labels, in order
const chips = (target: Locator) => target.locator("[data-ac-chip-input]");
const labels = (target: Locator) =>
  chips(target).locator("[data-ac-chip-input-part=label]").allTextContents();
const chip = (target: Locator, name: string) =>
  chips(target).filter({
    has: target.page().getByText(name, { exact: true }),
  });
const body = (target: Locator) =>
  target.locator("[data-ac-chip-input-part=body]");

// What the field's form submits under a name
const submitted = (page: Page, formId: string, name: string) =>
  page.evaluate(
    ([id, key]) =>
      new FormData(document.getElementById(id) as HTMLFormElement).getAll(key),
    [formId, name]
  );

// Records each `add` the fields fire, as its value, on window.__added
const recordAdds = (page: Page) =>
  page.evaluate(() => {
    const added: string[] = [];
    (window as unknown as { __added: string[] }).__added = added;
    document.addEventListener("add", (event) =>
      added.push((event as CustomEvent<{ value: string }>).detail.value)
    );
  });
const added = (page: Page) =>
  page.evaluate(() => (window as unknown as { __added: string[] }).__added);

test.describe("TextField with chips", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/text-field-chips");
  });

  // M3's Guidelines: input chips verify input by converting text into chips
  test("Enter turns the typed text into an editable chip before the cursor, and fires `add`", async ({
    page,
  }) => {
    await recordAdds(page);
    const to = field(page, "wrap", "To");
    await input(to).fill("  kenji@example.com ");
    await input(to).press("Enter");
    expect(await labels(to)).toEqual([
      "Ziad Aouad",
      "Ping Qiang",
      "lily@example.com",
      "kenji@example.com",
    ]);
    expect(await added(page)).toEqual(["kenji@example.com"]);
    await expect(input(to)).toHaveValue("");
    await expect(input(to)).toBeFocused();
    // the new chip is an editable one, named by its text, with a remove button named after it
    const created = chip(to, "kenji@example.com");
    await expect(created).toHaveAttribute("data-ac-chip-input", "edit");
    await expect(
      to.getByRole("button", { name: "Remove kenji@example.com", exact: true })
    ).toBeVisible();
    // and its ids are its own, not the template's
    const ids = await to
      .locator("[id]")
      .evaluateAll((els) => els.map((el) => el.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  // A translated field's new chips are named in its language, not English (the test above)
  test("the chips it makes name their remove and edit controls by chipRemoveLabel and chipEditLabel", async ({
    page,
  }) => {
    const target = field(page, "labels", "À");
    await input(target).fill("Lisbonne");
    await input(target).press("Enter");
    await expect(
      target.getByRole("button", { name: "Retirer Lisbonne", exact: true })
    ).toBeVisible();
    await body(chip(target, "Lisbonne")).click();
    await expect(
      target.getByRole("textbox", { name: "Modifier Lisbonne", exact: true })
    ).toBeFocused();
  });

  test("Enter on an empty field adds nothing, and submits its form as a text field's does", async ({
    page,
  }) => {
    await recordAdds(page);
    await page.evaluate(() => {
      const w = window as unknown as { __submits: number };
      w.__submits = 0;
      document.addEventListener("submit", (event) => {
        event.preventDefault();
        w.__submits++;
      });
    });
    const tags = field(page, "empty", "Tags");
    await input(tags).fill("   ");
    await input(tags).press("Enter");
    await expect(chips(tags)).toHaveCount(0);
    expect(await added(page)).toEqual([]);
    expect(
      await page.evaluate(
        () => (window as unknown as { __submits: number }).__submits
      )
    ).toBe(1);
  });

  test("the page can refuse the text, which stays in the field, or show a contact's name for it", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.addEventListener("add", (event) => {
        const detail = (event as CustomEvent<{ value: string; label: string }>)
          .detail;
        if (!detail.value.includes("@")) event.preventDefault();
        else if (detail.value === "sara@example.com")
          detail.label = "Sara Haddad";
      });
    });
    const to = field(page, "wrap", "To");
    await input(to).fill("sara");
    await input(to).press("Enter");
    await expect(chips(to)).toHaveCount(3);
    await expect(input(to)).toHaveValue("sara");

    await input(to).fill("sara@example.com");
    await input(to).press("Enter");
    await expect(chip(to, "Sara Haddad")).toHaveCount(1);
    expect(await submitted(page, "text-field-chips-wrap-form", "to")).toContain(
      "sara@example.com"
    );
  });

  // Each chip's value takes part in form submission, whether or not it's selected
  test("submits each chip's value, or its label, in order, selected or not, and not the typed text", async ({
    page,
  }) => {
    const to = field(page, "wrap", "To");
    await input(to).fill("draft");
    expect(await submitted(page, "text-field-chips-wrap-form", "to")).toEqual([
      "ziad@example.com",
      "ping@example.com",
      "lily@example.com",
    ]);
    await body(chip(to, "Ziad Aouad")).click();
    await expect(body(chip(to, "Ziad Aouad"))).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      await submitted(page, "text-field-chips-wrap-form", "to")
    ).toHaveLength(3);
  });

  test("a required field is valid once it holds a chip", async ({ page }) => {
    const tags = field(page, "empty", "Tags");
    const isValid = () =>
      page.evaluate(() =>
        (
          document.getElementById(
            "text-field-chips-empty-form"
          ) as HTMLFormElement
        ).checkValidity()
      );
    expect(await isValid()).toBe(false);
    await input(tags).fill("design");
    await input(tags).press("Enter");
    expect(await isValid()).toBe(true);
    await expect(input(tags)).not.toHaveAttribute("required");
    await body(chip(tags, "design")).focus();
    await page.keyboard.press("Delete");
    await expect(chips(tags)).toHaveCount(0);
    expect(await isValid()).toBe(false);
  });

  // M3's Guidelines: Backspace with the cursor before a chip selects it, and again deletes it
  test("Backspace at the start of the text selects the chip before it, and a second deletes it", async ({
    page,
  }) => {
    const to = field(page, "move", "To");
    await input(to).fill("ab");
    await input(to).press("Backspace");
    await expect(input(to)).toHaveValue("a");
    await input(to).press("Backspace");
    await expect(input(to)).toHaveValue("");
    await input(to).press("Backspace");
    const casey = body(chip(to, "Casey"));
    await expect(casey).toBeFocused();
    await expect(casey).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Backspace");
    expect(await labels(to)).toEqual(["Alex", "Blake"]);
    // the cursor comes back to the text, before the next chip
    await expect(input(to)).toBeFocused();
  });

  test("a chip selected by Backspace is deselected as focus leaves it, and typing goes back to the text", async ({
    page,
  }) => {
    const to = field(page, "move", "To");
    await input(to).press("Backspace");
    const casey = body(chip(to, "Casey"));
    await expect(casey).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.type("d");
    await expect(input(to)).toBeFocused();
    await expect(input(to)).toHaveValue("d");
    await expect(casey).toHaveAttribute("aria-pressed", "false");
  });

  test("the arrow keys move from the start of the text to the chips, and from the last chip back", async ({
    page,
  }) => {
    const to = field(page, "move", "To");
    await input(to).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(body(chip(to, "Casey"))).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(body(chip(to, "Blake"))).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(input(to)).toBeFocused();
    // with text before the cursor, ArrowLeft moves the cursor instead
    await input(to).fill("x");
    await page.keyboard.press("ArrowLeft");
    await expect(input(to)).toBeFocused();
  });

  // M3's Guidelines: a chip in edit mode reverts to text in the field
  test("an editable chip turns back into text in the field, and committing it updates its value", async ({
    page,
  }) => {
    const to = field(page, "wrap", "To");
    // by place, as its text changes
    const lily = chips(to).nth(2);
    await body(lily).click();
    const edit = lily.locator("[data-ac-chip-input-part=edit]");
    await expect(edit).toBeFocused();
    await edit.fill("lily.mac@example.com");
    await edit.press("Enter");
    await expect(lily.locator("[data-ac-chip-input-part=label]")).toHaveText(
      "lily.mac@example.com"
    );
    expect(await submitted(page, "text-field-chips-wrap-form", "to")).toEqual([
      "ziad@example.com",
      "ping@example.com",
      "lily.mac@example.com",
    ]);
  });

  test("editing a chip shown by a contact's name opens its address, and submits the edit", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.addEventListener("add", (event) => {
        (event as CustomEvent<{ label: string }>).detail.label = "Sara Haddad";
      });
    });
    const to = field(page, "wrap", "To");
    await input(to).fill("sara@example.com");
    await input(to).press("Enter");
    const sara = chips(to).nth(3);
    await body(sara).click();
    const edit = sara.locator("[data-ac-chip-input-part=edit]");
    await expect(edit).toHaveValue("sara@example.com");
    await edit.fill("sara.haddad@example.com");
    await edit.press("Enter");
    await expect(sara.locator("[data-ac-chip-input-part=label]")).toHaveText(
      "sara.haddad@example.com"
    );
    expect(
      (await submitted(page, "text-field-chips-wrap-form", "to")).at(-1)
    ).toBe("sara.haddad@example.com");
  });

  test("the label floats while the field holds chips, and rests in an empty field", async ({
    page,
  }) => {
    const fontSize = (target: Locator) =>
      target
        .locator("[data-ac-text-field-part=label]")
        .evaluate((el) => getComputedStyle(el).fontSize);
    const to = field(page, "wrap", "To");
    const tags = field(page, "empty", "Tags");
    await settled(page);
    expect(await fontSize(to)).toBe("12px");
    expect(await fontSize(tags)).toBe("16px");
  });

  test("focusing a chip shows the field's focus indicator", async ({
    page,
  }) => {
    const to = field(page, "wrap", "To");
    await body(chip(to, "Ziad Aouad")).focus();
    await settled(page);
    const indicator = to.locator("[data-ac-text-field-part=active-indicator]");
    expect(await indicator.evaluate((el) => getComputedStyle(el).height)).toBe(
      "3px"
    );
    expect(
      await indicator.evaluate((el) => getComputedStyle(el).backgroundColor)
    ).toBe(await resolvedColor(page, "var(--theme-color-primary)"));
  });

  test("the outlined field keeps its error state and supporting text", async ({
    page,
  }) => {
    const invalid = field(page, "outlined", "Invalid");
    await settled(page);
    expect(
      await invalid
        .locator("[data-ac-text-field-part=outline]")
        .evaluate((el) => getComputedStyle(el).borderTopColor)
    ).toBe(await resolvedColor(page, "var(--theme-color-error)"));
    await expect(input(invalid)).toHaveAccessibleDescription("Not a contact");
  });

  test("the chips are a group named by the field's label", async ({ page }) => {
    const to = field(page, "wrap", "To");
    await expect(to.getByRole("group", { name: "To" })).toBeVisible();
    await expect(to.getByRole("textbox", { name: "To" })).toBeVisible();
  });

  // M3's Guidelines: chips wrap to a new row if all need to be visible
  test("wraps the chips onto new rows, the field growing with them", async ({
    page,
  }) => {
    const to = field(page, "wrap", "To");
    const container = to.locator("[data-ac-text-field-part=container]");
    const before = (await box(container)).height;
    for (const name of ["kenji@example.com", "sara@example.com"]) {
      await input(to).fill(name);
      await input(to).press("Enter");
    }
    await settled(page);
    const tops = await chips(to).evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top))
    );
    expect(new Set(tops).size).toBeGreaterThan(1);
    expect((await box(container)).height).toBeGreaterThan(before);
  });

  // M3's Guidelines: overflowed chips follow text, the unfocused field showing the start of its
  // content, and focusing it putting the cursor at the end
  test("scrolls one row sideways, showing the start unfocused and the end focused", async ({
    page,
  }) => {
    const guests = field(page, "scroll", "Guests");
    const container = guests.locator("[data-ac-text-field-part=container]");
    // one row: a chip's 32px under a filled field's floated label, 24px above and 8px below
    expect((await box(container)).height).toBe(64);
    const group = guests.getByRole("group");
    const scroll = () => group.evaluate((el) => el.scrollLeft);
    expect(await group.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true
    );
    expect(await scroll()).toBe(0);

    await container.click({ position: { x: 4, y: 28 } });
    await expect(input(guests)).toBeFocused();
    await expect.poll(scroll).toBeGreaterThan(0);
    expect(
      await input(guests).evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const outer = el.closest("[role=group]")!.getBoundingClientRect();
        return rect.right <= outer.right + 1;
      })
    ).toBe(true);

    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await expect.poll(scroll).toBe(0);
  });

  test("Shift with an arrow key moves a chip within its field, keeping focus on it", async ({
    page,
  }) => {
    const to = field(page, "move", "To");
    await body(chip(to, "Alex")).focus();
    await page.keyboard.press("Shift+ArrowRight");
    expect(await labels(to)).toEqual(["Blake", "Alex", "Casey"]);
    await expect(body(chip(to, "Alex"))).toBeFocused();
    await expect(to.locator("[role=status]")).toHaveText("Alex, 2 of 3 in To");
    await page.keyboard.press("Shift+ArrowLeft");
    expect(await labels(to)).toEqual(["Alex", "Blake", "Casey"]);
    // it stops at the ends
    await page.keyboard.press("Shift+ArrowLeft");
    expect(await labels(to)).toEqual(["Alex", "Blake", "Casey"]);
    expect(await submitted(page, "text-field-chips-move-form", "to")).toEqual([
      "Alex",
      "Blake",
      "Casey",
    ]);
  });

  test("Shift with ArrowDown or ArrowUp moves a chip into the next or previous field of its form", async ({
    page,
  }) => {
    const to = field(page, "move", "To");
    const cc = field(page, "move", "Cc");
    await body(chip(to, "Blake")).focus();
    await page.keyboard.press("Shift+ArrowDown");
    expect(await labels(to)).toEqual(["Alex", "Casey"]);
    expect(await labels(cc)).toEqual(["Drew", "Blake"]);
    await expect(body(chip(cc, "Blake"))).toBeFocused();
    await expect(cc.locator("[role=status]")).toHaveText("Blake, 2 of 2 in Cc");
    expect(await submitted(page, "text-field-chips-move-form", "cc")).toEqual([
      "Drew",
      "Blake",
    ]);
    // there's no field after the last
    await page.keyboard.press("Shift+ArrowDown");
    expect(await labels(cc)).toEqual(["Drew", "Blake"]);
    await page.keyboard.press("Shift+ArrowUp");
    expect(await labels(to)).toEqual(["Alex", "Casey", "Blake"]);
  });

  test("a chip moved with the keyboard slides to its place on fast spatial", async ({
    page,
  }) => {
    const to = field(page, "move", "To");
    await body(chip(to, "Alex")).focus();
    await page.keyboard.press("Shift+ArrowRight");
    const timings = await chips(to).evaluateAll((els) =>
      els.flatMap((el) =>
        el.getAnimations().map((animation) => {
          const timing = animation.effect!.getTiming();
          return { duration: timing.duration, easing: timing.easing };
        })
      )
    );
    expect(timings.length).toBeGreaterThan(0);
    const root = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        duration: parseFloat(
          style.getPropertyValue("--theme-duration-spring-fast-spatial")
        ),
      };
    });
    for (const timing of timings) expect(timing.duration).toBe(root.duration);
  });

  test.describe("under reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("a moved chip goes to its place at once", async ({ page }) => {
      const to = field(page, "move", "To");
      await body(chip(to, "Alex")).focus();
      await page.keyboard.press("Shift+ArrowRight");
      expect(
        await chips(to).evaluateAll((els) =>
          els.flatMap((el) => el.getAnimations())
        )
      ).toHaveLength(0);
    });
  });

  test("a chip can be dragged to another place in its field", async ({
    page,
  }) => {
    const to = field(page, "move", "To");
    await to.scrollIntoViewIfNeeded();
    const alex = body(chip(to, "Alex"));
    const casey = await box(chip(to, "Casey"));
    const from = await box(alex);
    await page.mouse.move(from.x + 20, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + from.height / 2, { steps: 2 });
    await expect(alex).toHaveAttribute("data-ac-base-chip-dragged");
    await page.mouse.move(
      casey.x + casey.width - 4,
      casey.y + casey.height / 2,
      {
        steps: 8,
      }
    );
    await page.mouse.up();
    expect(await labels(to)).toEqual(["Blake", "Casey", "Alex"]);
    await expect(alex).not.toHaveAttribute("data-ac-base-chip-dragged");
    // the drag isn't a click: it doesn't select the chip
    await expect(alex).toHaveAttribute("aria-pressed", "false");
  });

  test("a chip can be dragged into another field", async ({ page }) => {
    const to = field(page, "move", "To");
    const cc = field(page, "move", "Cc");
    await section(page, "move").scrollIntoViewIfNeeded();
    const casey = body(chip(to, "Casey"));
    const from = await box(casey);
    const target = await box(input(cc));
    await page.mouse.move(from.x + 20, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 40, target.y + target.height / 2, {
      steps: 10,
    });
    await page.mouse.up();
    expect(await labels(to)).toEqual(["Alex", "Blake"]);
    expect(await labels(cc)).toEqual(["Drew", "Casey"]);
  });

  test("Escape puts a dragged chip back", async ({ page }) => {
    const to = field(page, "move", "To");
    await to.scrollIntoViewIfNeeded();
    const alex = body(chip(to, "Alex"));
    const casey = await box(chip(to, "Casey"));
    const from = await box(alex);
    await page.mouse.move(from.x + 20, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      casey.x + casey.width - 4,
      casey.y + casey.height / 2,
      {
        steps: 8,
      }
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await labels(to)).toEqual(["Alex", "Blake", "Casey"]);
    await expect(alex).not.toHaveAttribute("data-ac-base-chip-dragged");
  });

  test("right to left, the arrow keys mirror", async ({ page }) => {
    const rtl = field(page, "rtl", "إلى");
    await input(rtl).focus();
    await page.keyboard.press("ArrowRight");
    await expect(body(chip(rtl, "بينغ"))).toBeFocused();
    await page.keyboard.press("Shift+ArrowRight");
    expect(await labels(rtl)).toEqual(["بينغ", "زياد"]);
    await page.keyboard.press("ArrowLeft");
    await expect(body(chip(rtl, "زياد"))).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(input(rtl)).toBeFocused();
  });

  test("the chips sit inside the field, from its start", async ({ page }) => {
    for (const [caseId, label] of [
      ["wrap", "To"],
      ["rtl", "إلى"],
    ] as const) {
      const target = field(page, caseId, label);
      const outer = await box(
        target.locator("[data-ac-text-field-part=container]")
      );
      const first = await box(chips(target).first());
      const rtl = caseId === "rtl";
      const inset = rtl
        ? outer.x + outer.width - (first.x + first.width)
        : first.x - outer.x;
      expect(Math.round(inset)).toBe(16);
    }
  });
});
