// @ts-check
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
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
        "shiki/themes/github-light.mjs",
        "shiki/themes/github-dark.mjs",
      ],
    },
  },
});
