import { and, eq, gt, lte } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  articles,
  cmsMemberships,
  previewMediaReferences,
  previewSnapshots,
  type CmsMembership,
} from "@nite/cms-db";
import {
  editorialPublishableInputSchema,
  type EditorialDraftInput,
} from "./article-schema";
import {
  EditorialConflictError,
  validateEditorialInputForPublication,
} from "./editorial";
import { getEditorialMediaIds } from "./editor-document";
import type { CmsDatabase } from "./identity";

export const PREVIEW_SNAPSHOT_DURATION_MILLISECONDS = 10 * 60 * 1000;

export async function createEditorialPreviewSnapshot<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    articleId: string;
    baseRevisionId: string;
    input: EditorialDraftInput;
    now?: Date;
  },
) {
  const now = command.now ?? new Date();
  return database.transaction(async (transaction) => {
    const input = await validateEditorialInputForPublication(transaction, {
      actor: command.actor,
      input: command.input,
    });
    const [article] = await transaction
      .select({
        id: articles.id,
        currentRevisionId: articles.currentRevisionId,
      })
      .from(articles)
      .where(eq(articles.id, command.articleId))
      .limit(1)
      .for("update");
    if (!article || article.currentRevisionId !== command.baseRevisionId) {
      throw new EditorialConflictError();
    }

    await deleteExpiredEditorialPreviewSnapshots(transaction, now);
    const expiresAt = new Date(
      now.getTime() + PREVIEW_SNAPSHOT_DURATION_MILLISECONDS,
    );
    const [snapshot] = await transaction
      .insert(previewSnapshots)
      .values({
        articleId: article.id,
        baseRevisionId: command.baseRevisionId,
        actorMembershipId: command.actor.id,
        payload: input,
        expiresAt,
        createdAt: now,
      })
      .returning();
    if (!snapshot) throw new EditorialConflictError();
    const mediaIds = [input.coverMediaId, ...getEditorialMediaIds(input.body)];
    await transaction
      .insert(previewMediaReferences)
      .values(
        [...new Set(mediaIds)].map((mediaId) => ({
          snapshotId: snapshot.id,
          mediaId,
        })),
      )
      .onConflictDoNothing();
    return snapshot;
  });
}

export async function getEditorialPreviewSnapshot<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  claims: { articleId: string; snapshotId: string },
  now = new Date(),
) {
  await deleteExpiredEditorialPreviewSnapshots(database, now);
  const [result] = await database
    .select({
      snapshot: previewSnapshots,
      article: {
        id: articles.id,
        publishedAt: articles.publishedAt,
      },
    })
    .from(previewSnapshots)
    .innerJoin(articles, eq(previewSnapshots.articleId, articles.id))
    .innerJoin(
      cmsMemberships,
      eq(previewSnapshots.actorMembershipId, cmsMemberships.id),
    )
    .where(
      and(
        eq(previewSnapshots.id, claims.snapshotId),
        eq(previewSnapshots.articleId, claims.articleId),
        gt(previewSnapshots.expiresAt, now),
        eq(cmsMemberships.active, true),
      ),
    )
    .limit(1);
  if (!result) return undefined;
  return {
    ...result,
    input: editorialPublishableInputSchema.parse(result.snapshot.payload),
  };
}

export async function deleteExpiredEditorialPreviewSnapshots<
  TQueryResult extends PgQueryResultHKT,
>(database: CmsDatabase<TQueryResult>, now = new Date()) {
  return database
    .delete(previewSnapshots)
    .where(lte(previewSnapshots.expiresAt, now));
}
