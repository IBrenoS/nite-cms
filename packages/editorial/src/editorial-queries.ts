import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { newsCategoryValues } from "./article-schema";
import { editorialDocumentSchema } from "./editor-document";
import { type CmsDatabase, requireActiveCmsMembership } from "./identity";
import {
  articleRevisions,
  articles,
  mediaAssets,
  type CmsMembership,
} from "@nite/cms-db";

const editorialDashboardFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  category: z.enum(newsCategoryValues).optional(),
});

export type EditorialDashboardFilters = z.infer<
  typeof editorialDashboardFiltersSchema
>;

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function getEditorialArticlesDashboard<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  actor: CmsMembership,
  rawFilters: EditorialDashboardFilters = {},
) {
  const filters = editorialDashboardFiltersSchema.parse(rawFilters);
  const search = filters.search || undefined;
  const searchPattern = search ? `%${escapeLikePattern(search)}%` : undefined;

  await requireActiveCmsMembership(database, actor.id);
  const [counts] = await database
    .select({
      draft: sql<number>`count(*) filter (where ${articles.status} = 'draft')::int`,
      published: sql<number>`count(*) filter (where ${articles.status} = 'published')::int`,
      archived: sql<number>`count(*) filter (where ${articles.status} = 'archived')::int`,
    })
    .from(articles);

  const records = await database
    .select({
      article: articles,
      revision: articleRevisions,
      cover: {
        publicObjectKey: mediaAssets.publicObjectKey,
        status: mediaAssets.status,
      },
    })
    .from(articles)
    .leftJoin(
      articleRevisions,
      eq(articleRevisions.id, articles.currentRevisionId),
    )
    .leftJoin(mediaAssets, eq(mediaAssets.id, articleRevisions.coverMediaId))
    .where(
      and(
        searchPattern
          ? or(
              ilike(articleRevisions.title, searchPattern),
              ilike(articles.slug, searchPattern),
            )
          : undefined,
        filters.status ? eq(articles.status, filters.status) : undefined,
        filters.category
          ? eq(articleRevisions.category, filters.category)
          : undefined,
      ),
    )
    .orderBy(desc(articles.updatedAt));

  return {
    counts: counts ?? { draft: 0, published: 0, archived: 0 },
    records,
  };
}

export async function listEditorialArticles<
  TQueryResult extends PgQueryResultHKT,
>(database: CmsDatabase<TQueryResult>, actor: CmsMembership) {
  await requireActiveCmsMembership(database, actor.id);
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

  return selection.orderBy(desc(articles.updatedAt));
}

export async function getEditorialArticle<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  actor: CmsMembership,
  rawArticleId: string,
) {
  const articleId = z.uuid().parse(rawArticleId);
  await requireActiveCmsMembership(database, actor.id);
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
          body: editorialDocumentSchema.parse(revision.body),
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
