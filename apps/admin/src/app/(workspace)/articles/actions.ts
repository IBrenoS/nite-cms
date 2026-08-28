"use server";

import { z } from "zod";
import { after } from "next/server";

import {
  EditorialConflictError,
  EditorialPublicationError,
  createArticleDraft,
  createMediaUpload,
  editorialArticleInputSchema,
  mediaUploadFileSchema,
  processMediaAsset,
  publishArticle,
  saveArticleRevision,
  tiptapDocumentToNewsBlocks,
} from "@nite/editorial";
import { requireCmsContext } from "@/lib/auth";
import { getMediaObjectStore, sharpImageProcessor } from "@/lib/media-storage";
import { processCmsOutbox } from "@/lib/outbox";

export type EditorialActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message?: string;
  articleId?: string;
  revisionId?: string;
};

const formSchema = z.object({
  articleId: z.union([z.literal(""), z.uuid()]),
  expectedRevisionId: z.union([z.literal(""), z.uuid()]),
  intent: z.enum(["save", "publish"]),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  eventDate: z.string(),
  readTimeMinutes: z.coerce.number(),
  byline: z.string(),
  coverMediaId: z.union([z.literal(""), z.uuid()]),
  coverAlt: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  bodyDocument: z.string().min(1),
});

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseEditorialForm(formData: FormData) {
  const fields = formSchema.parse({
    articleId: readString(formData, "articleId"),
    expectedRevisionId: readString(formData, "expectedRevisionId"),
    intent: readString(formData, "intent"),
    slug: readString(formData, "slug"),
    title: readString(formData, "title"),
    summary: readString(formData, "summary"),
    category: readString(formData, "category"),
    eventDate: readString(formData, "eventDate"),
    readTimeMinutes: readString(formData, "readTimeMinutes"),
    byline: readString(formData, "byline"),
    coverMediaId: readString(formData, "coverMediaId"),
    coverAlt: readString(formData, "coverAlt"),
    seoTitle: readString(formData, "seoTitle"),
    seoDescription: readString(formData, "seoDescription"),
    bodyDocument: readString(formData, "bodyDocument"),
  });
  const seo =
    fields.seoTitle.length > 0 || fields.seoDescription.length > 0
      ? { title: fields.seoTitle, description: fields.seoDescription }
      : undefined;
  const input = editorialArticleInputSchema.parse({
    slug: fields.slug,
    title: fields.title,
    summary: fields.summary,
    category: fields.category,
    eventDate: fields.eventDate || undefined,
    readTimeMinutes: fields.readTimeMinutes,
    byline: fields.byline,
    coverMediaId: fields.coverMediaId || null,
    coverAlt: fields.coverAlt,
    featured: formData.get("featured") === "on",
    body: tiptapDocumentToNewsBlocks(JSON.parse(fields.bodyDocument)),
    seo,
  });
  return { fields, input };
}

export async function submitEditorialArticle(
  _previousState: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  try {
    const context = await requireCmsContext();
    const { fields, input } = parseEditorialForm(formData);
    const result = fields.articleId
      ? await saveArticleRevision(context.database, {
          actor: context.membership,
          articleId: fields.articleId,
          expectedRevisionId: fields.expectedRevisionId,
          input,
        })
      : await createArticleDraft(context.database, {
          actor: context.membership,
          input,
        });

    if (fields.intent === "publish") {
      await publishArticle(context.database, {
        actor: context.membership,
        articleId: result.article.id,
        expectedRevisionId: result.revision.id,
      });
      after(async () => {
        await processCmsOutbox().catch(() => undefined);
      });
    }

    return {
      status: "success",
      message:
        fields.intent === "publish"
          ? "Matéria publicada com a revisão atual."
          : "Nova revisão salva.",
      articleId: result.article.id,
      revisionId: result.revision.id,
    };
  } catch (error) {
    if (error instanceof EditorialConflictError) {
      return { status: "conflict", message: error.message };
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return {
        status: "error",
        message: "Revise os campos obrigatórios e o conteúdo antes de salvar.",
      };
    }
    if (error instanceof EditorialPublicationError) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message: "Não foi possível concluir a operação editorial.",
    };
  }
}

export async function createMediaUploadAction(input: {
  mimeType: string;
  byteSize: number;
}) {
  const context = await requireCmsContext();
  const upload = await createMediaUpload(
    context.database,
    getMediaObjectStore(),
    { actor: context.membership, file: mediaUploadFileSchema.parse(input) },
  );
  return { ...upload, expiresAt: upload.expiresAt.toISOString() };
}

export async function processMediaUploadAction(mediaId: string) {
  const context = await requireCmsContext();
  const media = await processMediaAsset(
    context.database,
    getMediaObjectStore(),
    sharpImageProcessor,
    { mediaId },
  );
  return { id: media.id, status: media.status };
}
