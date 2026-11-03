// @ts-check
import { defineConfig, fontProviders } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Roboto Flex",
      cssVariable: "--font-roboto-flex",
      // Roboto Flex has no italic (it slants with a slnt axis instead), so only the normal face
      // exists, and browsers synthesize italics from it
      styles: ["normal"],
      weights: ["100 1000"],
      // Only the weight and optical-size axes: M3's type scale uses both, and leaving out the
      // other 11 cuts the Latin file from 326KB to 84KB
      options: {
        experimental: { variableAxis: { opsz: [["8", "144"]] } },
      },
    },
  ],

  // Fenced code blocks in Markdown and MDX take the site's code themes, as Example and Usage
  // do, following the colour scheme. Astro's default, github-dark in both schemes, draws
  // comments at 3.05:1, short of AA's 4.5:1 (#256).
  markdown: {
    shikiConfig: {
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: "light-dark()",
    },
  },

  integrations: [mdx()],

  vite: {
    plugins: [tailwindcss()],
    // Lazily imported by the colors page on first change. Pre-bundled at startup
    // so the dev server doesn't discover them mid-session and answer the import
    // with "504 Outdated Optimize Dep".
    optimizeDeps: {
      include: [
        "shiki/core",
        "shiki/engine/javascript",
        "shiki/langs/css.mjs",
        "shiki/themes/github-light-default.mjs",
        "shiki/themes/github-dark-default.mjs",
      ],
    },
  },
});
