import { createHash, randomUUID } from "node:crypto";

import { and, eq, lt, or } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { type CmsDatabase, requireActiveCmsMembership } from "./identity";
import {
  mediaAssets,
  outboxEvents,
  type CmsMembership,
  type MediaAsset,
} from "@nite/cms-db";
import { parseAndNormalizeWebVtt } from "./webvtt";

const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_CAPTIONS_UPLOAD_BYTES = 1024 * 1024;
const UPLOAD_EXPIRATION_SECONDS = 5 * 60;
const PROCESSING_LEASE_MILLISECONDS = 5 * 60 * 1000;
const VIDEO_INSPECTION_BYTES = 8 * 1024 * 1024;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const mediaUploadFileSchema = z.union([
  z.object({
    mediaKind: z.literal("image").default("image"),
    mimeType: z.enum(allowedImageMimeTypes),
    byteSize: z.number().int().min(1).max(MAX_IMAGE_UPLOAD_BYTES),
  }),
  z.object({
    mediaKind: z.literal("video"),
    mimeType: z.literal("video/mp4"),
    byteSize: z.number().int().min(1).max(MAX_VIDEO_UPLOAD_BYTES),
  }),
  z.object({
    mediaKind: z.literal("captions"),
    mimeType: z.literal("text/vtt"),
    byteSize: z.number().int().min(1).max(MAX_CAPTIONS_UPLOAD_BYTES),
  }),
]);

export interface MediaObjectStore {
  createStagingUploadUrl(input: {
    stagingObjectKey: string;
    contentType: string;
    byteSize: number;
    expiresInSeconds: number;
  }): Promise<{
    url: string;
    requiredHeaders: Readonly<Record<string, string>>;
    expiresAt: Date;
  }>;
  getStagingObject(stagingObjectKey: string): Promise<Uint8Array>;
  headStagingObject(stagingObjectKey: string): Promise<{
    byteSize: number | undefined;
    contentType: string | undefined;
    etag: string | undefined;
  }>;
  getStagingObjectRange(
    stagingObjectKey: string,
    start: number,
    end: number,
  ): Promise<Uint8Array>;
  copyStagingObjectToPublic(input: {
    stagingObjectKey: string;
    publicObjectKey: string;
    sourceEtag: string;
    contentType: "video/mp4";
    cacheControl: string;
  }): Promise<void>;
  putPublicObject(input: {
    publicObjectKey: string;
    body: Uint8Array;
    contentType: "image/webp" | "text/vtt; charset=utf-8";
  }): Promise<void>;
  deleteStagingObject(stagingObjectKey: string): Promise<void>;
  deletePublicObject(publicObjectKey: string): Promise<void>;
}

export interface ImageProcessor {
  toWebp(input: Uint8Array): Promise<{
    body: Uint8Array;
    width: number;
    height: number;
  }>;
}

export interface VideoInspector {
  inspect(input: Uint8Array): Promise<{
    durationMs: number;
    width: number;
    height: number;
    codec: string;
    hasAudio: boolean;
  }>;
}

export class MediaProcessingError extends Error {
  constructor(message = "Não foi possível processar a mídia.") {
    super(message);
    this.name = "MediaProcessingError";
  }
}

export class MediaQuarantinedError extends MediaProcessingError {
  constructor() {
    super("A mídia foi enviada para quarentena por falhar na validação.");
    this.name = "MediaQuarantinedError";
  }
}

function detectImageMimeType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    )
  ) {
    return "image/png" as const;
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    return "image/jpeg" as const;
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp" as const;
  }
  return undefined;
}

async function findMedia<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  mediaId: string,
) {
  const [media] = await database
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
    .limit(1);
  return media;
}

async function quarantineClaim<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  claimed: MediaAsset,
): Promise<never> {
  await database
    .update(mediaAssets)
    .set({ status: "quarantined", updatedAt: new Date() })
    .where(
      and(
        eq(mediaAssets.id, claimed.id),
        eq(mediaAssets.status, "processing"),
        eq(mediaAssets.updatedAt, claimed.updatedAt),
      ),
    );
  throw new MediaQuarantinedError();
}

async function markClaimReady<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  claimed: MediaAsset,
  values: {
    publicObjectKey: string;
    mimeType: string;
    byteSize: number;
    width?: number;
    height?: number;
    checksumSha256?: string;
    durationMs?: number;
    videoCodec?: string;
    hasAudio?: boolean;
    objectEtag?: string;
  },
): Promise<MediaAsset> {
  return database.transaction(async (transaction) => {
    const [ready] = await transaction
      .update(mediaAssets)
      .set({ ...values, status: "ready", updatedAt: new Date() })
      .where(
        and(
          eq(mediaAssets.id, claimed.id),
          eq(mediaAssets.status, "processing"),
          eq(mediaAssets.updatedAt, claimed.updatedAt),
        ),
      )
      .returning();
    if (!ready) throw new MediaProcessingError();
    await transaction.insert(outboxEvents).values({
      id: randomUUID(),
      topic: "media.staging.purge",
      aggregateId: claimed.id,
      payload: {
        mediaId: claimed.id,
        stagingObjectKey: claimed.stagingObjectKey,
      },
    });
    return ready;
  });
}

export async function createMediaUpload<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  objectStore: MediaObjectStore,
  command: {
    actor: CmsMembership;
    file: z.input<typeof mediaUploadFileSchema>;
  },
) {
  const file = mediaUploadFileSchema.parse(command.file);
  const actor = await requireActiveCmsMembership(database, command.actor.id);
  const mediaId = randomUUID();
  const stagingObjectKey = `incoming/${mediaId}/original`;

  await database.insert(mediaAssets).values({
    id: mediaId,
    mediaKind: file.mediaKind,
    stagingObjectKey,
    mimeType: file.mimeType,
    byteSize: file.byteSize,
    status: "pending",
    createdByMembershipId: actor.id,
  });

  try {
    const upload = await objectStore.createStagingUploadUrl({
      stagingObjectKey,
      contentType: file.mimeType,
      byteSize: file.byteSize,
      expiresInSeconds: UPLOAD_EXPIRATION_SECONDS,
    });
    return {
      mediaId,
      mediaKind: file.mediaKind,
      uploadUrl: upload.url,
      requiredHeaders: upload.requiredHeaders,
      expiresAt: upload.expiresAt,
    };
  } catch {
    await database
      .update(mediaAssets)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(mediaAssets.id, mediaId));
    throw new MediaProcessingError("Não foi possível iniciar o upload.");
  }
}

export async function processMediaAsset<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  objectStore: MediaObjectStore,
  imageProcessor: ImageProcessor,
  command: { mediaId: string },
  videoInspector?: VideoInspector,
): Promise<MediaAsset> {
  const mediaId = z.uuid().parse(command.mediaId);
  const claimedAt = new Date();
  const leaseExpiresAt = new Date(
    claimedAt.getTime() - PROCESSING_LEASE_MILLISECONDS,
  );
  const [claimed] = await database
    .update(mediaAssets)
    .set({ status: "processing", updatedAt: claimedAt })
    .where(
      and(
        eq(mediaAssets.id, mediaId),
        or(
          eq(mediaAssets.status, "pending"),
          and(
            eq(mediaAssets.status, "processing"),
            lt(mediaAssets.updatedAt, leaseExpiresAt),
          ),
        ),
      ),
    )
    .returning();

  if (!claimed) {
    const existing = await findMedia(database, mediaId);
    if (existing?.status === "ready") return existing;
    throw new MediaProcessingError(
      "A mídia não está disponível para processamento.",
    );
  }

  try {
    if (claimed.mediaKind === "image") {
      const source = await objectStore.getStagingObject(
        claimed.stagingObjectKey,
      );
      const detectedMimeType = detectImageMimeType(source);
      if (
        source.byteLength !== claimed.byteSize ||
        detectedMimeType !== claimed.mimeType
      ) {
        return quarantineClaim(database, claimed);
      }

      const output = await imageProcessor.toWebp(source);
      if (output.width < 1 || output.height < 1 || output.body.byteLength < 1) {
        throw new MediaProcessingError();
      }
      const checksumSha256 = createHash("sha256")
        .update(output.body)
        .digest("hex");
      const publicObjectKey = `news/${mediaId}/${checksumSha256}.webp`;
      await objectStore.putPublicObject({
        publicObjectKey,
        body: output.body,
        contentType: "image/webp",
      });
      return await markClaimReady(database, claimed, {
        publicObjectKey,
        mimeType: "image/webp",
        byteSize: output.body.byteLength,
        width: output.width,
        height: output.height,
        checksumSha256,
      });
    }

    if (claimed.mediaKind === "video") {
      const head = await objectStore.headStagingObject(
        claimed.stagingObjectKey,
      );
      const normalizedEtag = head.etag?.replaceAll('"', "").trim();
      if (
        head.byteSize !== claimed.byteSize ||
        head.contentType !== claimed.mimeType ||
        !head.etag ||
        !normalizedEtag
      ) {
        return quarantineClaim(database, claimed);
      }
      if (!videoInspector) throw new MediaProcessingError();
      const inspectionBytes = await objectStore.getStagingObjectRange(
        claimed.stagingObjectKey,
        0,
        Math.min(claimed.byteSize, VIDEO_INSPECTION_BYTES) - 1,
      );
      if (
        inspectionBytes.byteLength < 1 ||
        inspectionBytes.byteLength > VIDEO_INSPECTION_BYTES
      ) {
        return quarantineClaim(database, claimed);
      }
      let metadata: Awaited<ReturnType<VideoInspector["inspect"]>>;
      try {
        metadata = await videoInspector.inspect(inspectionBytes);
      } catch {
        return quarantineClaim(database, claimed);
      }
      if (
        metadata.durationMs < 1 ||
        metadata.width < 1 ||
        metadata.height < 1 ||
        (!metadata.codec.startsWith("avc1") &&
          !metadata.codec.startsWith("avc3"))
      ) {
        return quarantineClaim(database, claimed);
      }
      const publicObjectKey = `news/${mediaId}/${normalizedEtag}.mp4`;
      await objectStore.copyStagingObjectToPublic({
        stagingObjectKey: claimed.stagingObjectKey,
        publicObjectKey,
        sourceEtag: head.etag,
        contentType: "video/mp4",
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      });
      return await markClaimReady(database, claimed, {
        publicObjectKey,
        mimeType: "video/mp4",
        byteSize: claimed.byteSize,
        width: metadata.width,
        height: metadata.height,
        durationMs: metadata.durationMs,
        videoCodec: metadata.codec,
        hasAudio: metadata.hasAudio,
        objectEtag: head.etag,
      });
    }

    const source = await objectStore.getStagingObject(claimed.stagingObjectKey);
    if (source.byteLength !== claimed.byteSize) {
      return quarantineClaim(database, claimed);
    }
    let output: ReturnType<typeof parseAndNormalizeWebVtt>;
    try {
      output = parseAndNormalizeWebVtt(source);
    } catch {
      return quarantineClaim(database, claimed);
    }
    const publicObjectKey = `news/${mediaId}/${output.checksumSha256}.vtt`;
    await objectStore.putPublicObject({
      publicObjectKey,
      body: output.body,
      contentType: "text/vtt; charset=utf-8",
    });
    return await markClaimReady(database, claimed, {
      publicObjectKey,
      mimeType: "text/vtt",
      byteSize: output.body.byteLength,
      checksumSha256: output.checksumSha256,
    });
  } catch (error) {
    if (error instanceof MediaQuarantinedError) throw error;
    await database
      .update(mediaAssets)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(mediaAssets.id, mediaId),
          eq(mediaAssets.status, "processing"),
          eq(mediaAssets.updatedAt, claimed.updatedAt),
        ),
      );
    if (error instanceof MediaProcessingError) throw error;
    throw new MediaProcessingError();
  }
}
