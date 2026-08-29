import { z } from "zod";

import { editorialDocumentV1Schema } from "./editor-document";

export const newsCategoryValues = [
  "agenda",
  "comunidade",
  "projetos",
  "inovacao",
  "cultura",
  "tecnologia",
] as const;

export const newsContentStateValues = ["demonstrativo", "real"] as const;

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
