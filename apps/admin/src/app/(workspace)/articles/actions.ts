"use server";

import { z } from "zod";
import { after } from "next/server";

import {
  archiveArticle,
  createEditorialPreviewSnapshot,
  createMediaUpload,
  deleteEditorialArticle,
  getEditorialArticleDeletionImpact,
  mediaUploadFileSchema,
  processMediaAsset,
  restoreArticle,
  submitEditorialRevision,
  unpublishArticle,
  getEditorialRevisionPreview,
  validateEditorialRevisionForPreview,
} from "@nite/editorial";
import { revalidatePath } from "next/cache";
import { requireCmsContext } from "@/lib/auth";
import { getMediaObjectStore, sharpImageProcessor } from "@/lib/media-storage";
import { mp4BoxVideoInspector } from "@/lib/mp4box-video-inspector";
import { processCmsOutbox } from "@/lib/outbox";
import { readPreviewConfiguration } from "@/lib/preview-config";
import {
  issuePreviewSnapshotToken,
  issuePreviewToken,
} from "@/lib/preview-token";
import {
  editorialActionFailure,
  type EditorialActionResult,
} from "@/lib/editorial-errors";
import { parseEditorialFormData } from "@/lib/editorial-form";

type EditorialSubmitData = {
  articleId: string;
  revisionId: string;
  version: number;
  status: "draft" | "published" | "archived";
  publishedRevisionId: string | null;
};
export type EditorialActionState =
  { status: "idle" } | EditorialActionResult<EditorialSubmitData>;

export async function submitEditorialArticle(
  _previousState: EditorialActionState,
  formData: FormData,
): Promise<EditorialActionState> {
  try {
    const context = await requireCmsContext();
    const { fields, input, intent } = parseEditorialFormData(formData);
    const result = await submitEditorialRevision(context.database, {
      actor: context.membership,
      intent,
      target: fields.articleId
        ? {
            kind: "existing",
            articleId: fields.articleId,
            expectedRevisionId: fields.expectedRevisionId,
          }
        : { kind: "new" },
      slugManuallyEdited: fields.slugManuallyEdited === "true",
      input,
    });

    return {
      status: "success",
      message:
        intent === "publish"
          ? "Matéria publicada com a revisão atual."
          : "Nova revisão salva.",
      data: {
        articleId: result.article.id,
        revisionId: result.revision.id,
        version: result.revision.version,
        status: result.article.status,
        publishedRevisionId: result.article.publishedRevisionId,
      },
    };
  } catch (error) {
    return editorialActionFailure(
      error,
      formData.get("intent") === "publish" ? "publish" : "save",
    );
  }
}

export async function createMediaUploadAction(input: {
  mediaKind?: "image" | "video" | "captions";
  mimeType: string;
  byteSize: number;
}) {
  try {
    const context = await requireCmsContext();
    const upload = await createMediaUpload(
      context.database,
      getMediaObjectStore(),
      { actor: context.membership, file: mediaUploadFileSchema.parse(input) },
    );
    return {
      status: "success" as const,
      data: { ...upload, expiresAt: upload.expiresAt.toISOString() },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: "operation_error" as const,
        code: "media_file" as const,
        message:
          "Use JPEG, PNG ou WebP de até 10 MiB, MP4 de até 100 MiB ou WebVTT de até 1 MiB.",
        retryable: true,
      };
    }
    return editorialActionFailure(error, "media");
  }
}

export async function processMediaUploadAction(mediaId: string) {
  try {
    const context = await requireCmsContext();
    const media = await processMediaAsset(
      context.database,
      getMediaObjectStore(),
      sharpImageProcessor,
      { mediaId },
      mp4BoxVideoInspector,
    );
    return {
      status: "success" as const,
      data: {
        id: media.id,
        mediaKind: media.mediaKind,
        mediaStatus: media.status,
        mimeType: media.mimeType,
        publicObjectKey: media.publicObjectKey,
        width: media.width,
        height: media.height,
        durationMs: media.durationMs,
        videoCodec: media.videoCodec,
        hasAudio: media.hasAudio,
        checksumSha256: media.checksumSha256,
        objectEtag: media.objectEtag,
      },
    };
  } catch (error) {
    return editorialActionFailure(error, "media");
  }
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
    return { status: "success" as const, data: {} };
  } catch (error) {
    return editorialActionFailure(error, "lifecycle");
  }
}

const deletionSchema = z.object({
  articleId: z.uuid(),
  expectedRevisionId: z.uuid(),
});

export async function getEditorialArticleDeletionImpactAction(input: unknown) {
  try {
    const context = await requireCmsContext();
    const command = deletionSchema.parse(input);
    const impact = await getEditorialArticleDeletionImpact(context.database, {
      actor: context.membership,
      ...command,
    });
    return { status: "success" as const, data: impact };
  } catch (error) {
    return editorialActionFailure(error, "delete");
  }
}

export async function deleteEditorialArticleAction(input: unknown) {
  try {
    const context = await requireCmsContext();
    const command = deletionSchema.parse(input);
    const result = await deleteEditorialArticle(context.database, {
      actor: context.membership,
      ...command,
    });
    revalidatePath("/");
    after(async () => {
      await processCmsOutbox().catch(() => undefined);
    });
    return {
      status: "success" as const,
      message: `Matéria excluída. Limpeza de ${result.scheduledMediaCount} mídias agendada.`,
      data: result,
    };
  } catch (error) {
    return editorialActionFailure(error, "delete");
  }
}

const previewLinkSchema = z.object({
  articleId: z.uuid(),
  revisionId: z.uuid(),
});

export async function createLivePreviewLink(formData: FormData) {
  try {
    const context = await requireCmsContext();
    formData.set("intent", "save");
    const { fields, input } = parseEditorialFormData(formData);
    if (!fields.articleId || !fields.expectedRevisionId) {
      return {
        status: "operation_error" as const,
        code: "not_found" as const,
        message: "Salve o primeiro rascunho antes de abrir o preview.",
        retryable: false,
      };
    }
    const preview = readPreviewConfiguration(process.env);
    if (!preview.configured) {
      return {
        status: "operation_error" as const,
        code: "preview_unavailable" as const,
        message: "O Preview no Portal não está configurado neste ambiente.",
        retryable: false,
      };
    }
    const snapshot = await createEditorialPreviewSnapshot(context.database, {
      actor: context.membership,
      articleId: fields.articleId,
      baseRevisionId: fields.expectedRevisionId,
      input,
    });
    const url = new URL(preview.configuration.portalPreviewUrl);
    url.searchParams.set(
      "token",
      issuePreviewSnapshotToken(
        { articleId: fields.articleId, snapshotId: snapshot.id },
        preview.configuration.hmacSecret,
      ),
    );
    return { status: "success" as const, data: { url: url.toString() } };
  } catch (error) {
    return editorialActionFailure(error, "preview");
  }
}

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
      return {
        status: "operation_error" as const,
        code: "not_found" as const,
        message: "Revisão não encontrada.",
        retryable: false,
      };
    await validateEditorialRevisionForPreview(context.database, {
      actor: context.membership,
      articleId: request.articleId,
      revisionId: request.revisionId,
    });
    const preview = readPreviewConfiguration(process.env);
    if (!preview.configured) {
      return {
        status: "operation_error" as const,
        code: "preview_unavailable" as const,
        message: "O Preview no Portal não está configurado neste ambiente.",
        retryable: false,
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
    return {
      status: "success" as const,
      data: { url: url.toString() },
    };
  } catch (error) {
    return editorialActionFailure(error, "preview");
  }
}
