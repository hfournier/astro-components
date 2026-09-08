/* eslint-disable */
// @ts-nocheck
import A from "./internal/mdx/A.astro";
import Blockquote from "./internal/mdx/Blockquote.astro";
import H1 from "./internal/mdx/H1.astro";
import H2 from "./internal/mdx/H2.astro";
import H3 from "./internal/mdx/H3.astro";
import H4 from "./internal/mdx/H4.astro";
import H5 from "./internal/mdx/H5.astro";
import H6 from "./internal/mdx/H6.astro";
import Li from "./internal/mdx/Li.astro";
import Ol from "./internal/mdx/Ol.astro";
import P from "./internal/mdx/P.astro";
import Ul from "./internal/mdx/Ul.astro";

import Button from "./components/button/Button.astro";
import Dialog from "./components/dialog/Dialog.astro";
import DialogConfirm from "./components/dialog-confirm/DialogConfirm.astro";
import Heading from "./components/heading/Heading.astro";
import Icon from "./components/icon/Icon.astro";
import Link from "./components/link/Link.astro";
import Popover from "./components/popover/Popover.astro";
import Tab from "./components/tab/Tab.astro";
import Tabs from "./components/tabs/Tabs.astro";

export const components = {
  a: A,
  blockquote: Blockquote,
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  li: Li,
  ol: Ol,
  p: P,
  ul: Ul,
  Button,
  Dialog,
  DialogConfirm,
  Heading,
  Icon,
  Link,
  Popover,
  Tab,
  Tabs,
};
