import { createHash, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { type CmsDatabase, requireActiveCmsMembership } from "./identity";
import { mediaAssets, type CmsMembership, type MediaAsset } from "@nite/cms-db";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_EXPIRATION_SECONDS = 5 * 60;
const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const mediaUploadFileSchema = z.object({
  mimeType: z.enum(allowedImageMimeTypes),
  byteSize: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
});

export interface MediaObjectStore {
  createUploadUrl(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    expiresInSeconds: number;
  }): Promise<{
    url: string;
    requiredHeaders: Readonly<Record<string, string>>;
    expiresAt: Date;
  }>;
  getObject(objectKey: string): Promise<Uint8Array>;
  putObject(input: {
    objectKey: string;
    body: Uint8Array;
    contentType: "image/webp";
  }): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}

export interface ImageProcessor {
  toWebp(input: Uint8Array): Promise<{
    body: Uint8Array;
    width: number;
    height: number;
  }>;
}

export class MediaProcessingError extends Error {
  constructor(message = "Não foi possível processar a imagem.") {
    super(message);
    this.name = "MediaProcessingError";
  }
}

export class MediaQuarantinedError extends MediaProcessingError {
  constructor() {
    super("A imagem foi enviada para quarentena por falhar na validação.");
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

export async function createMediaUpload<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  objectStore: MediaObjectStore,
  command: {
    actor: CmsMembership;
    file: z.infer<typeof mediaUploadFileSchema>;
  },
) {
  const file = mediaUploadFileSchema.parse(command.file);
  const actor = await requireActiveCmsMembership(database, command.actor.id);
  const mediaId = randomUUID();
  const objectKey = `incoming/${mediaId}`;

  await database.insert(mediaAssets).values({
    id: mediaId,
    objectKey,
    mimeType: file.mimeType,
    byteSize: file.byteSize,
    status: "pending",
    createdByMembershipId: actor.id,
  });

  try {
    const upload = await objectStore.createUploadUrl({
      objectKey,
      contentType: file.mimeType,
      byteSize: file.byteSize,
      expiresInSeconds: UPLOAD_EXPIRATION_SECONDS,
    });
    return {
      mediaId,
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
): Promise<MediaAsset> {
  const mediaId = z.uuid().parse(command.mediaId);
  const [claimed] = await database
    .update(mediaAssets)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.status, "pending")))
    .returning();

  if (!claimed) {
    const existing = await findMedia(database, mediaId);
    if (existing?.status === "ready") return existing;
    throw new MediaProcessingError(
      "A imagem não está disponível para processamento.",
    );
  }

  try {
    const source = await objectStore.getObject(claimed.objectKey);
    const detectedMimeType = detectImageMimeType(source);
    if (
      source.byteLength !== claimed.byteSize ||
      detectedMimeType !== claimed.mimeType
    ) {
      await database
        .update(mediaAssets)
        .set({ status: "quarantined", updatedAt: new Date() })
        .where(eq(mediaAssets.id, mediaId));
      throw new MediaQuarantinedError();
    }

    const output = await imageProcessor.toWebp(source);
    if (output.width < 1 || output.height < 1 || output.body.byteLength < 1) {
      throw new MediaProcessingError();
    }
    const objectKey = `news/${mediaId}.webp`;
    const checksumSha256 = createHash("sha256")
      .update(output.body)
      .digest("hex");

    await objectStore.putObject({
      objectKey,
      body: output.body,
      contentType: "image/webp",
    });
    const [ready] = await database
      .update(mediaAssets)
      .set({
        objectKey,
        mimeType: "image/webp",
        byteSize: output.body.byteLength,
        width: output.width,
        height: output.height,
        checksumSha256,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(
        and(eq(mediaAssets.id, mediaId), eq(mediaAssets.status, "processing")),
      )
      .returning();
    if (!ready) {
      throw new MediaProcessingError();
    }
    await objectStore.deleteObject(claimed.objectKey);
    return ready;
  } catch (error) {
    if (error instanceof MediaQuarantinedError) throw error;
    await database
      .update(mediaAssets)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(eq(mediaAssets.id, mediaId), eq(mediaAssets.status, "processing")),
      );
    if (error instanceof MediaProcessingError) throw error;
    throw new MediaProcessingError();
  }
}
