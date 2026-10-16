import type { Page } from "@playwright/test";
import { test, expect } from "./support/a11y-fixture";
import { colorInside, resolvedColor } from "./support/helpers";

// One background role from each of BaseWrapper's pairing rules, with the "on" role its text
// takes and the role links and focus rings switch to there: surfaces keep primary links and
// secondary rings, the inverse surface takes the inverse roles, a container uses its own "on"
// role for all three, and a fixed role uses its "on" role for text and its variant for the rest.
// The a11y fixture's axe scan checks text and link contrast on every role on the test page.
const ROLES = [
  {
    bg: "surface-container",
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
    bg: "secondary-fixed",
    text: "on-secondary-fixed",
    link: "on-secondary-fixed-variant",
    ring: "on-secondary-fixed-variant",
  },
] as const;

// Each case on /tests/base-wrapper, base-wrapper-<bg>, holds one BaseWrapper as="section" on that
// background role. The transparent case's own Section is on surface-container-lowest, the
// surrounding wrapper whose colors it keeps.
type WrapperCaseId = (typeof ROLES)[number]["bg"] | "transparent";

const wrapper = (page: Page, bg: WrapperCaseId) =>
  page.getByTestId(`base-wrapper-${bg}`).locator("section");

test.describe("BaseWrapper", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/base-wrapper");
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
