import { z } from "zod";

import {
  editorialDraftInputSchema,
  editorialPublishableInputSchema,
  tiptapDocumentToEditorialDocumentV1,
} from "@nite/editorial";

export type EditorialField =
  | "slug"
  | "title"
  | "summary"
  | "category"
  | "body"
  | "byline"
  | "eventDate"
  | "coverMedia"
  | "coverAlt"
  | "seoTitle"
  | "seoDescription";

export type EditorialFieldErrors = Partial<Record<EditorialField, string[]>>;

const formSchema = z.object({
  articleId: z.union([z.literal(""), z.uuid()]),
  expectedRevisionId: z.union([z.literal(""), z.uuid()]),
  intent: z.enum(["save", "publish"]),
  slug: z.string(),
  slugManuallyEdited: z.enum(["true", "false"]),
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  eventDate: z.string(),
  byline: z.string(),
  coverMediaId: z.union([z.literal(""), z.uuid()]),
  coverAlt: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  bodyDocument: z.string().min(1),
});

export class EditorialBodyParseError extends Error {
  constructor() {
    super("O conteúdo da matéria está inválido.");
    this.name = "EditorialBodyParseError";
  }
}

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function parseEditorialFormData(formData: FormData) {
  const fields = formSchema.parse({
    articleId: readString(formData, "articleId"),
    expectedRevisionId: readString(formData, "expectedRevisionId"),
    intent: readString(formData, "intent"),
    slug: readString(formData, "slug"),
    slugManuallyEdited: readString(formData, "slugManuallyEdited"),
    title: readString(formData, "title"),
    summary: readString(formData, "summary"),
    category: readString(formData, "category"),
    eventDate: readString(formData, "eventDate"),
    byline: readString(formData, "byline"),
    coverMediaId: readString(formData, "coverMediaId"),
    coverAlt: readString(formData, "coverAlt"),
    seoTitle: readString(formData, "seoTitle"),
    seoDescription: readString(formData, "seoDescription"),
    bodyDocument: readString(formData, "bodyDocument"),
  });
  let body: ReturnType<typeof tiptapDocumentToEditorialDocumentV1>;
  try {
    body = tiptapDocumentToEditorialDocumentV1(
      JSON.parse(fields.bodyDocument) as unknown,
    );
  } catch {
    throw new EditorialBodyParseError();
  }
  const seo =
    fields.seoTitle.length > 0 || fields.seoDescription.length > 0
      ? { title: fields.seoTitle, description: fields.seoDescription }
      : undefined;
  const candidate = {
    slug: fields.slug,
    title: fields.title,
    summary: fields.summary,
    category: fields.category,
    eventDate: fields.eventDate || undefined,
    byline: fields.byline,
    coverMediaId: fields.coverMediaId || null,
    coverAlt: fields.coverAlt,
    featured: formData.get("featured") === "on",
    body,
    seo,
  };
  const input =
    fields.intent === "publish"
      ? editorialPublishableInputSchema.parse(candidate)
      : editorialDraftInputSchema.parse(candidate);
  return { fields, input, intent: fields.intent };
}

const fieldByPath: Record<string, EditorialField> = {
  slug: "slug",
  slugManuallyEdited: "slug",
  title: "title",
  summary: "summary",
  category: "category",
  eventDate: "eventDate",
  byline: "byline",
  coverMediaId: "coverMedia",
  coverAlt: "coverAlt",
  body: "body",
  bodyDocument: "body",
  "body.content": "body",
  seo: "seoTitle",
  "seo.title": "seoTitle",
  "seo.description": "seoDescription",
};

const messageByField: Record<EditorialField, string> = {
  slug: "Informe um slug válido com pelo menos 3 caracteres.",
  title: "Revise o título da matéria.",
  summary: "O resumo deve ter entre 48 e 220 caracteres.",
  category: "Selecione uma categoria.",
  body: "Inclua conteúdo significativo no corpo da matéria.",
  byline: "A assinatura deve ter entre 3 e 80 caracteres.",
  eventDate: "Informe uma data de evento válida.",
  coverMedia: "Selecione uma capa processada.",
  coverAlt: "O texto alternativo da capa deve ter pelo menos 12 caracteres.",
  seoTitle: "O título SEO deve ter entre 20 e 60 caracteres.",
  seoDescription: "A descrição SEO deve ter entre 80 e 160 caracteres.",
};

export function zodFieldErrors(error: unknown): EditorialFieldErrors {
  if (
    error instanceof EditorialBodyParseError ||
    error instanceof SyntaxError
  ) {
    return { body: ["O conteúdo da matéria está inválido."] };
  }
  if (!(error instanceof z.ZodError)) return {};
  const result: EditorialFieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    const field =
      fieldByPath[path] ??
      fieldByPath[String(issue.path[0] ?? "")] ??
      undefined;
    if (!field || result[field]) continue;
    result[field] = [messageByField[field]];
  }
  return result;
}
