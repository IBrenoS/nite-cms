import { randomUUID } from "node:crypto";

import { and, eq, inArray, lt, notExists } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import {
  articleMediaReferences,
  mediaAssets,
  outboxEvents,
  previewMediaReferences,
} from "@nite/cms-db";
import type { CmsDatabase } from "./identity";
import type { MediaObjectStore } from "./media";

const ORPHAN_GRACE_PERIOD_MS = 48 * 60 * 60 * 1_000;
const purgeCommandSchema = z.object({ mediaId: z.uuid() });

export async function scheduleOrphanMediaPurges<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  input: { now?: Date; batchSize?: number } = {},
) {
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - ORPHAN_GRACE_PERIOD_MS);
  const batchSize = z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .parse(input.batchSize);

  return database.transaction(async (transaction) => {
    const candidates = await transaction
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          inArray(mediaAssets.status, [
            "pending",
            "processing",
            "ready",
            "failed",
            "quarantined",
          ]),
          lt(mediaAssets.createdAt, cutoff),
          notExists(
            transaction
              .select({ mediaId: articleMediaReferences.mediaId })
              .from(articleMediaReferences)
              .where(eq(articleMediaReferences.mediaId, mediaAssets.id)),
          ),
          notExists(
            transaction
              .select({ mediaId: previewMediaReferences.mediaId })
              .from(previewMediaReferences)
              .where(eq(previewMediaReferences.mediaId, mediaAssets.id)),
          ),
        ),
      )
      .orderBy(mediaAssets.createdAt)
      .limit(batchSize)
      .for("update", { skipLocked: true });
    if (candidates.length === 0) return { scheduled: 0 };

    const claimed = await transaction
      .update(mediaAssets)
      .set({ status: "deleting", updatedAt: now })
      .where(
        and(
          inArray(
            mediaAssets.id,
            candidates.map(({ id }) => id),
          ),
          inArray(mediaAssets.status, [
            "pending",
            "processing",
            "ready",
            "failed",
            "quarantined",
          ]),
        ),
      )
      .returning({ id: mediaAssets.id });
    if (claimed.length > 0) {
      await transaction.insert(outboxEvents).values(
        claimed.map(({ id }) => ({
          id: randomUUID(),
          topic: "media.asset.purge",
          aggregateId: id,
          payload: { mediaId: id },
        })),
      );
    }
    return { scheduled: claimed.length };
  });
}

export async function purgeDeletingMediaAsset<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  objectStore: MediaObjectStore,
  rawCommand: { mediaId: string },
) {
  const command = purgeCommandSchema.parse(rawCommand);
  const [media] = await database
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, command.mediaId))
    .limit(1);
  if (!media) return { deleted: false };
  if (media.status !== "deleting") {
    throw new Error("A mídia não está agendada para exclusão.");
  }

  const [articleReference, previewReference] = await Promise.all([
    database
      .select({ mediaId: articleMediaReferences.mediaId })
      .from(articleMediaReferences)
      .where(eq(articleMediaReferences.mediaId, media.id))
      .limit(1),
    database
      .select({ mediaId: previewMediaReferences.mediaId })
      .from(previewMediaReferences)
      .where(eq(previewMediaReferences.mediaId, media.id))
      .limit(1),
  ]);
  if (articleReference.length > 0 || previewReference.length > 0) {
    throw new Error("A mídia voltou a possuir referências editoriais.");
  }

  await objectStore.deleteStagingObject(media.stagingObjectKey);
  if (media.publicObjectKey) {
    await objectStore.deletePublicObject(media.publicObjectKey);
  }
  const deleted = await database
    .delete(mediaAssets)
    .where(
      and(eq(mediaAssets.id, media.id), eq(mediaAssets.status, "deleting")),
    )
    .returning({ id: mediaAssets.id });
  return { deleted: deleted.length === 1 };
}
