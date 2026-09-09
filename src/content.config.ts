import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const propSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  default: z.string().nullable().optional(),
  description: z.string(),
});

const slotSchema = z.discriminatedUnion("kind", [
  z.object({
    name: z.string(),
    description: z.string(),
    kind: z.literal("any"),
  }),
  z.object({
    name: z.string(),
    description: z.string(),
    kind: z.literal("text"),
  }),
  z.object({
    name: z.string(),
    description: z.string(),
    kind: z.literal("component"),
    component: z.string(),
    multiple: z.boolean().default(false),
  }),
]);

const cssPropSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const extendsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("element"),
    tag: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal("component"),
    name: z.string(),
  }),
]);

const metaSchema = z.object({
  title: z.string().max(60),
  description: z.string().max(160),
});

const components = defineCollection({
  loader: glob({ pattern: "**/documentation.mdx", base: "./src/components" }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    role: z.enum(["primitive", "pattern", "internal"]),
    meta: metaSchema,
    props: z.array(propSchema).optional(),
    slots: z.array(slotSchema).optional(),
    cssProps: z.array(cssPropSchema).optional(),
    extends: extendsSchema.nullable().optional(),
    parents: z.array(z.string()).min(1).optional(),
  }),
});

const usage = defineCollection({
  loader: glob({ pattern: "**/usage.mdx", base: "./src/components" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    show: z
      .enum(["both", "code-only", "preview-only", "none"])
      .default("both"),
  }),
});

const examples = defineCollection({
  loader: glob({ pattern: "**/example-*.mdx", base: "./src/components" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { components, usage, examples };
