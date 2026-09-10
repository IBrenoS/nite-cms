import { and, eq, inArray, ne, notExists, sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import {
  articleMediaReferences,
  articleRevisions,
  articles,
  auditEvents,
  mediaAssets,
  outboxEvents,
  previewMediaReferences,
  previewSnapshots,
  type CmsMembership,
} from "@nite/cms-db";
import { EditorialConflictError, EditorialPublicationError } from "./editorial";
import {
  CmsAuthorizationError,
  type CmsDatabase,
  requireActiveCmsMembership,
} from "./identity";

const deletionCommandSchema = z.object({
  articleId: z.uuid(),
  expectedRevisionId: z.uuid(),
});

async function requireDeletionAdmin<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  actor: CmsMembership,
) {
  const activeActor = await requireActiveCmsMembership(database, actor.id);
  if (activeActor.role !== "admin") throw new CmsAuthorizationError();
  return activeActor;
}

async function getDeletionContext<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  command: { articleId: string; expectedRevisionId: string },
  lock: boolean,
) {
  let articleQuery = database
    .select()
    .from(articles)
    .where(eq(articles.id, command.articleId))
    .limit(1);
  if (lock) articleQuery = articleQuery.for("update") as typeof articleQuery;
  const [article] = await articleQuery;
  if (!article || article.currentRevisionId !== command.expectedRevisionId) {
    throw new EditorialConflictError();
  }

  const [
    currentRevisionRows,
    revisions,
    snapshots,
    articleReferences,
    snapshotReferences,
  ] = await Promise.all([
    database
      .select({ title: articleRevisions.title })
      .from(articleRevisions)
      .where(eq(articleRevisions.id, command.expectedRevisionId))
      .limit(1),
    database
      .select({ id: articleRevisions.id })
      .from(articleRevisions)
      .where(eq(articleRevisions.articleId, article.id)),
    database
      .select({ id: previewSnapshots.id })
      .from(previewSnapshots)
      .where(eq(previewSnapshots.articleId, article.id)),
    database
      .select({ mediaId: articleMediaReferences.mediaId })
      .from(articleMediaReferences)
      .where(eq(articleMediaReferences.articleId, article.id)),
    database
      .select({ mediaId: previewMediaReferences.mediaId })
      .from(previewMediaReferences)
      .innerJoin(
        previewSnapshots,
        eq(previewMediaReferences.snapshotId, previewSnapshots.id),
      )
      .where(eq(previewSnapshots.articleId, article.id)),
  ]);
  const [currentRevision] = currentRevisionRows;
  if (!currentRevision) throw new EditorialConflictError();
  return {
    article,
    title: currentRevision.title,
    revisionCount: revisions.length,
    revisionIds: revisions.map(({ id }) => id),
    snapshotCount: snapshots.length,
    mediaIds: [
      ...new Set(
        [...articleReferences, ...snapshotReferences].map(
          ({ mediaId }) => mediaId,
        ),
      ),
    ],
  };
}

async function findReferencedMediaIds<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  mediaIds: string[],
) {
  if (mediaIds.length === 0) return new Set<string>();
  const [articleReferences, snapshotReferences] = await Promise.all([
    database
      .select({ mediaId: articleMediaReferences.mediaId })
      .from(articleMediaReferences)
      .where(inArray(articleMediaReferences.mediaId, mediaIds)),
    database
      .select({ mediaId: previewMediaReferences.mediaId })
      .from(previewMediaReferences)
      .where(inArray(previewMediaReferences.mediaId, mediaIds)),
  ]);
  return new Set(
    [...articleReferences, ...snapshotReferences].map(({ mediaId }) => mediaId),
  );
}

export async function getEditorialArticleDeletionImpact<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    articleId: string;
    expectedRevisionId: string;
  },
) {
  const parsed = deletionCommandSchema.parse(command);
  await requireDeletionAdmin(database, command.actor);
  const context = await getDeletionContext(database, parsed, false);
  if (context.mediaIds.length === 0) {
    return {
      title: context.title,
      slug: context.article.slug,
      status: context.article.status,
      revisionCount: context.revisionCount,
      snapshotCount: context.snapshotCount,
      mediaCount: 0,
      exclusiveMediaCount: 0,
      sharedMediaCount: 0,
    };
  }

  const [articleUsages, snapshotUsages] = await Promise.all([
    database
      .select({
        mediaId: articleMediaReferences.mediaId,
        articleId: articleMediaReferences.articleId,
      })
      .from(articleMediaReferences)
      .where(inArray(articleMediaReferences.mediaId, context.mediaIds)),
    database
      .select({
        mediaId: previewMediaReferences.mediaId,
        articleId: previewSnapshots.articleId,
      })
      .from(previewMediaReferences)
      .innerJoin(
        previewSnapshots,
        eq(previewMediaReferences.snapshotId, previewSnapshots.id),
      )
      .where(inArray(previewMediaReferences.mediaId, context.mediaIds)),
  ]);
  const sharedMediaIds = new Set(
    [...articleUsages, ...snapshotUsages]
      .filter(({ articleId }) => articleId !== context.article.id)
      .map(({ mediaId }) => mediaId),
  );

  return {
    title: context.title,
    slug: context.article.slug,
    status: context.article.status,
    revisionCount: context.revisionCount,
    snapshotCount: context.snapshotCount,
    mediaCount: context.mediaIds.length,
    exclusiveMediaCount: context.mediaIds.length - sharedMediaIds.size,
    sharedMediaCount: sharedMediaIds.size,
  };
}

export async function deleteEditorialArticle<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    articleId: string;
    expectedRevisionId: string;
  },
) {
  const parsed = deletionCommandSchema.parse(command);
  return database.transaction(async (transaction) => {
    const actor = await requireDeletionAdmin(transaction, command.actor);
    const context = await getDeletionContext(transaction, parsed, true);

    await transaction.insert(auditEvents).values({
      actorMembershipId: actor.id,
      action: "article.deleted",
      aggregateType: "article",
      aggregateId: context.article.id,
      metadata: {
        slug: context.article.slug,
        previousStatus: context.article.status,
        currentRevisionId: context.article.currentRevisionId,
        publishedRevisionId: context.article.publishedRevisionId,
        revisionCount: context.revisionCount,
        revisionIds: context.revisionIds,
        snapshotCount: context.snapshotCount,
        mediaCandidateCount: context.mediaIds.length,
      },
    });

    if (context.article.publishedRevisionId) {
      const [publishedRevision] = await transaction
        .select({ category: articleRevisions.category })
        .from(articleRevisions)
        .where(eq(articleRevisions.id, context.article.publishedRevisionId))
        .limit(1);
      if (!publishedRevision) {
        throw new EditorialPublicationError(
          "A matéria publicada não possui uma revisão pública válida.",
        );
      }
      await transaction.insert(outboxEvents).values({
        topic: "news.article.unpublished",
        aggregateId: context.article.id,
        payload: {
          articleId: context.article.id,
          revisionId: context.article.publishedRevisionId,
          slug: context.article.slug,
          category: publishedRevision.category,
        },
      });
    }

    const [detached] = await transaction
      .update(articles)
      .set({
        status: "draft",
        currentRevisionId: null,
        publishedRevisionId: null,
        updatedByMembershipId: actor.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(articles.id, context.article.id),
          eq(articles.currentRevisionId, parsed.expectedRevisionId),
        ),
      )
      .returning({ id: articles.id });
    if (!detached) throw new EditorialConflictError();

    await transaction.execute(
      sql`select set_config('nite.cms_delete_article_id', ${context.article.id}, true)`,
    );
    const deleted = await transaction
      .delete(articles)
      .where(eq(articles.id, context.article.id))
      .returning({ id: articles.id });
    if (deleted.length !== 1) throw new EditorialConflictError();

    const referencedMediaIds = await findReferencedMediaIds(
      transaction,
      context.mediaIds,
    );
    const orphanMediaIds = context.mediaIds.filter(
      (mediaId) => !referencedMediaIds.has(mediaId),
    );
    const scheduledMedia =
      orphanMediaIds.length === 0
        ? []
        : await transaction
            .update(mediaAssets)
            .set({ status: "deleting", updatedAt: new Date() })
            .where(
              and(
                inArray(mediaAssets.id, orphanMediaIds),
                ne(mediaAssets.status, "deleting"),
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
            .returning({ id: mediaAssets.id });
    if (scheduledMedia.length > 0) {
      await transaction.insert(outboxEvents).values(
        scheduledMedia.map(({ id }) => ({
          topic: "media.asset.purge",
          aggregateId: id,
          payload: { mediaId: id },
        })),
      );
    }

    return {
      articleId: context.article.id,
      deletedRevisionCount: context.revisionCount,
      deletedSnapshotCount: context.snapshotCount,
      scheduledMediaCount: scheduledMedia.length,
    };
  });
}
