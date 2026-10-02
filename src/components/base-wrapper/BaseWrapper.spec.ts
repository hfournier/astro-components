import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../../test/a11y-fixture";

async function resolvedColor(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.color = value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssValue);
}

// A custom property as the color it resolves to inside `el`, where BaseWrapper set it
const colorInside = (el: Locator, property: string) =>
  el.evaluate((node, p) => {
    const probe = document.createElement("div");
    probe.style.color = `var(${p})`;
    node.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, property);

// Every background role, with the "on" role its text takes and the role links and focus rings
// switch to there (mirrors BaseWrapper's colorClasses and its [data-ac-wrapper] rules).
const ROLES = [
  {
    bg: "surface-container-lowest",
    text: "on-surface",
    link: "primary",
    ring: "secondary",
  },
  {
    bg: "surface-container-low",
    text: "on-surface",
    link: "primary",
    ring: "secondary",
  },
  {
    bg: "surface-container",
    text: "on-surface",
    link: "primary",
    ring: "secondary",
  },
  {
    bg: "surface-container-high",
    text: "on-surface",
    link: "primary",
    ring: "secondary",
  },
  {
    bg: "surface-container-highest",
    text: "on-surface",
    link: "primary",
    ring: "secondary",
  },
  { bg: "surface-dim", text: "on-surface", link: "primary", ring: "secondary" },
  {
    bg: "surface-bright",
    text: "on-surface",
    link: "primary",
    ring: "secondary",
  },
  {
    bg: "inverse-surface",
    text: "inverse-on-surface",
    link: "inverse-primary",
    ring: "inverse-primary",
  },
  {
    bg: "primary-container",
    text: "on-primary-container",
    link: "on-primary-container",
    ring: "on-primary-container",
  },
  {
    bg: "secondary-container",
    text: "on-secondary-container",
    link: "on-secondary-container",
    ring: "on-secondary-container",
  },
  {
    bg: "tertiary-container",
    text: "on-tertiary-container",
    link: "on-tertiary-container",
    ring: "on-tertiary-container",
  },
  {
    bg: "primary-fixed",
    text: "on-primary-fixed",
    link: "on-primary-fixed-variant",
    ring: "on-primary-fixed-variant",
  },
  {
    bg: "primary-fixed-dim",
    text: "on-primary-fixed",
    link: "on-primary-fixed-variant",
    ring: "on-primary-fixed-variant",
  },
  {
    bg: "secondary-fixed",
    text: "on-secondary-fixed",
    link: "on-secondary-fixed-variant",
    ring: "on-secondary-fixed-variant",
  },
  {
    bg: "secondary-fixed-dim",
    text: "on-secondary-fixed",
    link: "on-secondary-fixed-variant",
    ring: "on-secondary-fixed-variant",
  },
  {
    bg: "tertiary-fixed",
    text: "on-tertiary-fixed",
    link: "on-tertiary-fixed-variant",
    ring: "on-tertiary-fixed-variant",
  },
  {
    bg: "tertiary-fixed-dim",
    text: "on-tertiary-fixed",
    link: "on-tertiary-fixed-variant",
    ring: "on-tertiary-fixed-variant",
  },
] as const;

// BaseWrapper is a primitive with no live example of its own; Section's example-01 renders one
// Section (a BaseWrapper as="section") per background role, each labelled by a <code> with the
// role's name, inside the CodePreview's surface-container-lowest preview wrapper.
const wrapper = (page: Page, bg: string) =>
  page
    .getByTestId("code-preview")
    .locator("section")
    .filter({ has: page.locator("code", { hasText: new RegExp(`^${bg}$`) }) });

test.describe("BaseWrapper", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/components/section");
  });

  for (const { bg, text, link, ring } of ROLES) {
    test(`"${bg}" paints its role, its on-role text, and readable link and focus-ring roles`, async ({
      page,
    }) => {
      const role = (name: string) =>
        resolvedColor(page, `var(--theme-color-${name})`);
      const target = wrapper(page, bg);

      await expect(target).toHaveCSS("background-color", await role(bg));
      await expect(target).toHaveCSS("color", await role(text));
      expect(await colorInside(target, "--theme-color-wrapper-bg")).toBe(
        await role(bg)
      );
      expect(await colorInside(target, "--theme-color-focus-ring-on-bg")).toBe(
        await role(ring)
      );
      await expect(target.getByRole("link")).toHaveCSS(
        "color",
        await role(link)
      );
      // The a11y fixture's axe scan (ADR-0002) then checks every role's text and link contrast.
    });
  }

  test('"transparent" paints nothing and keeps the surrounding wrapper\'s colors', async ({
    page,
  }) => {
    const target = wrapper(page, "transparent");
    const surrounding = await resolvedColor(
      page,
      "var(--theme-color-surface-container-lowest)"
    );

    await expect(target).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect(await colorInside(target, "--theme-color-wrapper-bg")).toBe(
      surrounding
    );
    await expect(target.getByRole("link")).toHaveCSS(
      "color",
      await resolvedColor(page, "var(--theme-color-primary)")
    );
  });

  test("renders the element named by `as`, without leaking `as` as an attribute", async ({
    page,
  }) => {
    const target = wrapper(page, "surface-container");

    await expect(target).toHaveJSProperty("tagName", "SECTION");
    await expect(target).not.toHaveAttribute("as");
  });

  test("a consumer's class merges over the wrapper's own classes", async ({
    page,
  }) => {
    const target = wrapper(page, "surface-container");

    await expect(target).toHaveCSS("padding-top", "16px");
    await expect(target).toHaveCSS("border-top-left-radius", "12px");
  });
});
