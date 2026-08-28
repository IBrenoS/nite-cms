import { and, desc, eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { newsBodyBlockSchema } from "./article-schema";
import { type CmsDatabase, requireActiveCmsMembership } from "./identity";
import { articleRevisions, articles, type CmsMembership } from "@nite/cms-db";

function assertArticleReadable(
  actor: CmsMembership,
  article: typeof articles.$inferSelect,
) {
  if (actor.role === "author" && article.createdByMembershipId !== actor.id) {
    throw new Error("Matéria não encontrada.");
  }
}

export async function listEditorialArticles<
  TQueryResult extends PgQueryResultHKT,
>(database: CmsDatabase<TQueryResult>, actor: CmsMembership) {
  const activeActor = await requireActiveCmsMembership(database, actor.id);
  const selection = database
    .select({
      article: articles,
      revision: articleRevisions,
    })
    .from(articles)
    .leftJoin(
      articleRevisions,
      eq(articleRevisions.id, articles.currentRevisionId),
    );

  return activeActor.role === "author"
    ? selection
        .where(eq(articles.createdByMembershipId, activeActor.id))
        .orderBy(desc(articles.updatedAt))
    : selection.orderBy(desc(articles.updatedAt));
}

export async function getEditorialArticle<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  actor: CmsMembership,
  rawArticleId: string,
) {
  const articleId = z.uuid().parse(rawArticleId);
  const activeActor = await requireActiveCmsMembership(database, actor.id);
  const [result] = await database
    .select({ article: articles, revision: articleRevisions })
    .from(articles)
    .leftJoin(
      articleRevisions,
      eq(articleRevisions.id, articles.currentRevisionId),
    )
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!result) return undefined;
  assertArticleReadable(activeActor, result.article);
  return result;
}

export async function getEditorialRevisionPreview<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  actor: CmsMembership,
  rawArticleId: string,
  rawRevisionId?: string,
) {
  const result = await getEditorialArticle(database, actor, rawArticleId);
  if (!result) return undefined;
  const revisionId = rawRevisionId
    ? z.uuid().parse(rawRevisionId)
    : result.article.currentRevisionId;
  if (!revisionId) return undefined;

  const [revision] = await database
    .select()
    .from(articleRevisions)
    .where(
      and(
        eq(articleRevisions.id, revisionId),
        eq(articleRevisions.articleId, result.article.id),
      ),
    )
    .limit(1);
  return revision
    ? {
        article: result.article,
        revision: {
          ...revision,
          body: z.array(newsBodyBlockSchema).parse(revision.body),
        },
      }
    : undefined;
}

export async function listEditorialRevisions<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  actor: CmsMembership,
  rawArticleId: string,
) {
  const result = await getEditorialArticle(database, actor, rawArticleId);
  if (!result) return [];

  return database
    .select({
      id: articleRevisions.id,
      version: articleRevisions.version,
      title: articleRevisions.title,
      createdAt: articleRevisions.createdAt,
    })
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, result.article.id))
    .orderBy(desc(articleRevisions.version));
}
