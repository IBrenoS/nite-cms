import { z } from "zod";

import {
  editorialDocumentV1Schema,
  persistedEditorialDocumentV1Schema,
  storableEditorialDocumentV1Schema,
} from "./editor-document";

export const newsCategoryValues = [
  "agenda",
  "comunidade",
  "projetos",
  "inovacao",
  "cultura",
  "tecnologia",
] as const;

export const newsContentStateValues = ["demonstrativo", "real"] as const;

export function deriveEditorialSlug(title: string) {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

export const editableEditorialSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);

const draftSeoSchema = z
  .object({
    title: z.string().max(60),
    description: z.string().max(160),
  })
  .optional();

export const editorialDraftInputSchema = z.object({
  slug: editableEditorialSlugSchema.or(z.literal("")).optional(),
  title: z.string().trim().min(1).max(100),
  summary: z.string().max(220),
  category: z.enum(newsCategoryValues).or(z.literal("")),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  byline: z.string().max(80),
  featured: z.boolean(),
  body: storableEditorialDocumentV1Schema,
  seo: draftSeoSchema,
  coverMediaId: z.uuid().nullable(),
  coverAlt: z.string().trim(),
});

export const editorialPublishableInputSchema = z.object({
  slug: editableEditorialSlugSchema.min(3),
  title: z.string().trim().min(12).max(100),
  summary: z.string().trim().min(48).max(220),
  category: z.enum(newsCategoryValues),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  byline: z.string().trim().min(3).max(80),
  featured: z.boolean(),
  body: persistedEditorialDocumentV1Schema,
  seo: z
    .object({
      title: z.string().trim().min(20).max(60),
      description: z.string().trim().min(80).max(160),
    })
    .optional(),
  coverMediaId: z.uuid(),
  coverAlt: z.string().trim().min(12),
});

export type EditorialDraftInput = z.infer<typeof editorialDraftInputSchema>;
export type EditorialPublishableInput = z.infer<
  typeof editorialPublishableInputSchema
>;

export const newsArticleSchema = z.object({
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(12).max(100),
  summary: z.string().min(48).max(220),
  category: z.enum(newsCategoryValues),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  readTimeMinutes: z.number().int().min(1).max(30),
  byline: z.string().min(3).max(80),
  cover: z.object({ src: z.url(), alt: z.string().min(12) }),
  featured: z.boolean(),
  contentState: z.enum(newsContentStateValues),
  public: z.literal(true),
  body: editorialDocumentV1Schema,
  seo: z
    .object({
      title: z.string().min(20).max(60),
      description: z.string().min(80).max(160),
    })
    .optional(),
});

export type NewsArticle = z.infer<typeof newsArticleSchema>;
export type NewsCategory = (typeof newsCategoryValues)[number];
export type NewsContentState = (typeof newsContentStateValues)[number];
