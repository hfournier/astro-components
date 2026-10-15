import {
  COMMENT_NODE,
  ELEMENT_NODE,
  TEXT_NODE,
  parse,
  render,
  type ElementNode,
} from "ultrahtml";
import type { SvgIconNameTypes } from "./svgs";
import type { TabType } from "./types";

// What Tabs found that isn't a Tab, for its error message: an element's tag or a text excerpt
const describeNode = (node: ElementNode | { type: number; value: string }) =>
  node.type === ELEMENT_NODE
    ? `<${(node as ElementNode).name}>`
    : `"${(node as { value: string }).value.trim().replace(/\s+/g, " ").slice(0, 40)}"`;

/**
 * Collects the Tabs in a Tabs component's rendered slot: each Tab's label, icon and badge for the
 * tablist, and its panel, linked to its tab button. Each Tab must be a direct child of Tabs, since
 * it's found by its top-level `data-ac-tabpanel` element; anything else at the top level, other
 * than whitespace and comments, throws rather than being dropped from the page.
 *
 * @param html - Tabs' rendered default slot, from `await Astro.slots.render("default")`.
 * @param randomId - The id shared by this Tabs' tab buttons (`tab-<id>-<n>`) and panels
 * (`tabpanel-<id>-<n>`), numbered from 1.
 * @returns The tabs, in order, and each one's panel HTML, all but the first hidden.
 */
export const collectTabs = async (html: string, randomId: string) => {
  const tabs: TabType[] = [];
  const tabContents: string[] = [];

  for (const node of parse(html).children) {
    if (node.type === COMMENT_NODE) continue;
    if (node.type === TEXT_NODE && node.value.trim() === "") continue;
    if (
      node.type !== ELEMENT_NODE ||
      node.attributes["data-ac-tabpanel"] === undefined
    ) {
      throw new Error(
        `Tabs: found ${describeNode(node)}, but only Tabs can go in Tabs, each as a direct child (not wrapped in another element or component).`
      );
    }

    const tabIndex = tabs.length + 1;
    node.attributes["id"] = `tabpanel-${randomId}-${tabIndex}`;
    if (tabIndex !== 1) {
      node.attributes["hidden"] = "true";
    }
    node.attributes["aria-labelledby"] = `tab-${randomId}-${tabIndex}`;
    tabs.push({
      label: node.attributes["data-ac-tab-label"] || "",
      badgeLabel: node.attributes["data-ac-tab-badge"],
      icon: node.attributes["data-ac-tab-icon"] as SvgIconNameTypes,
    });
    // strip the build-time marker attributes
    delete node.attributes["data-ac-tab-label"];
    delete node.attributes["data-ac-tab-badge"];
    delete node.attributes["data-ac-tab-icon"];
    tabContents.push(await render(node));
  }

  if (tabs.length === 0) {
    throw new Error(
      "Tabs: expected at least one Tab as a direct child, but found none."
    );
  }

  return { tabs, tabContents };
};
