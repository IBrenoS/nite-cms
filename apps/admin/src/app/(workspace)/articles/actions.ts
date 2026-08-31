"use server";

import { z } from "zod";
import { after } from "next/server";

import {
  EditorialConflictError,
  EditorialPublicationError,
  archiveArticle,
  createArticleDraft,
  createMediaUpload,
  editorialArticleInputSchema,
  mediaUploadFileSchema,
  processMediaAsset,
  publishArticle,
  restoreArticle,
  saveArticleRevision,
  tiptapDocumentToEditorialDocumentV1,
  unpublishArticle,
  getEditorialRevisionPreview,
} from "@nite/editorial";
import { revalidatePath } from "next/cache";
import { requireCmsContext } from "@/lib/auth";
import { getMediaObjectStore, sharpImageProcessor } from "@/lib/media-storage";
import { processCmsOutbox } from "@/lib/outbox";
import { readPreviewConfiguration } from "@/lib/preview-config";
import { issuePreviewToken } from "@/lib/preview-token";

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
    byline: fields.byline,
    coverMediaId: fields.coverMediaId || null,
    coverAlt: fields.coverAlt,
    featured: formData.get("featured") === "on",
    body: tiptapDocumentToEditorialDocumentV1(JSON.parse(fields.bodyDocument)),
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
          slugManuallyEdited: fields.slugManuallyEdited === "true",
          input,
        })
      : await createArticleDraft(context.database, {
          actor: context.membership,
          slugManuallyEdited: fields.slugManuallyEdited === "true",
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

const lifecycleSchema = z.object({
  articleId: z.uuid(),
  expectedRevisionId: z.uuid(),
  intent: z.enum(["unpublish", "archive", "restore"]),
});

export async function transitionEditorialArticle(input: unknown) {
  try {
    const context = await requireCmsContext();
    const command = lifecycleSchema.parse(input);
    const lifecycleCommand = {
      actor: context.membership,
      articleId: command.articleId,
      expectedRevisionId: command.expectedRevisionId,
    };
    if (command.intent === "unpublish") {
      await unpublishArticle(context.database, lifecycleCommand);
    } else if (command.intent === "archive") {
      await archiveArticle(context.database, lifecycleCommand);
    } else {
      await restoreArticle(context.database, lifecycleCommand);
    }
    revalidatePath(`/articles/${command.articleId}/edit`);
    revalidatePath("/");
    return { status: "success" as const };
  } catch (error) {
    if (error instanceof EditorialConflictError) {
      return { status: "conflict" as const, message: error.message };
    }
    if (
      error instanceof EditorialPublicationError ||
      error instanceof z.ZodError
    ) {
      return {
        status: "error" as const,
        message:
          error instanceof EditorialPublicationError
            ? error.message
            : "A operação editorial é inválida.",
      };
    }
    return {
      status: "error" as const,
      message: "Não foi possível alterar o ciclo de vida da matéria.",
    };
  }
}

const previewLinkSchema = z.object({
  articleId: z.uuid(),
  revisionId: z.uuid(),
});

export async function createPrivatePreviewLink(input: unknown) {
  try {
    const context = await requireCmsContext();
    const request = previewLinkSchema.parse(input);
    const revision = await getEditorialRevisionPreview(
      context.database,
      context.membership,
      request.articleId,
      request.revisionId,
    );
    if (!revision)
      return { status: "error" as const, message: "Revisão não encontrada." };
    const preview = readPreviewConfiguration(process.env);
    if (!preview.configured) {
      return {
        status: "error" as const,
        message: "O preview privado não está configurado neste ambiente.",
      };
    }
    const url = new URL(preview.configuration.portalPreviewUrl);
    url.searchParams.set(
      "token",
      issuePreviewToken(
        { articleId: request.articleId, revisionId: request.revisionId },
        preview.configuration.hmacSecret,
      ),
    );
    return { status: "success" as const, url: url.toString() };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: "error" as const,
        message: "A referência de preview é inválida.",
      };
    }
    return {
      status: "error" as const,
      message: "Não foi possível criar o preview privado.",
    };
  }
}
