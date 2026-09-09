import { readdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { svgIconNames } from './icon-names';

// Drift check (mirrors the ADR-0009 §11 prop-manifest check): `svgIconNames` is
// hand-authored so it can produce the `SvgIconNameTypes` literal union for Icon
// `name` intellisense - Vite's import.meta.glob only yields `string` keys. This
// test makes forgetting to update it impossible: it must match the .svg files in
// src/assets/svgs exactly. No browser work, so it stays in the one test suite.
test('svgIconNames matches the files in src/assets/svgs', () => {
  const onDisk = readdirSync(new URL('../assets/svgs', import.meta.url))
    .filter((file) => file.endsWith('.svg'))
    .map((file) => file.replace(/\.svg$/, ''))
    .sort();

  expect([...svgIconNames].sort()).toEqual(onDisk);
});
