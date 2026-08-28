import { desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";

import { publishedArticles, type PublishedArticleRow } from "@nite/cms-db";
import { newsArticleSchema, type NewsArticle } from "./article-schema";

type PublicNewsDatabase<TQueryResult extends PgQueryResultHKT> = Pick<
  PgDatabase<TQueryResult, typeof import("@nite/cms-db/schema")>,
  "select"
>;

function buildPublicMediaUrl(baseUrl: string, objectKey: string) {
  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("A URL pública de mídia deve usar HTTP ou HTTPS.");
  }

  const segments = objectKey.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new Error("A chave pública de mídia é inválida.");
  }

  return new URL(segments.map(encodeURIComponent).join("/"), base).toString();
}

export function mapPublishedArticle(
  row: PublishedArticleRow,
  mediaBaseUrl: string,
): NewsArticle {
  return newsArticleSchema.parse({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    publishedAt: row.publishedAt.toISOString().slice(0, 10),
    ...(row.eventDate ? { eventDate: row.eventDate } : {}),
    readTimeMinutes: row.readTimeMinutes,
    byline: row.byline,
    cover: {
      src: buildPublicMediaUrl(mediaBaseUrl, row.coverObjectKey),
      alt: row.coverAlt,
    },
    featured: row.featured,
    contentState: row.contentState,
    public: row.public,
    body: row.body,
    ...(row.seo ? { seo: row.seo } : {}),
  });
}

export async function listPublishedNews<TQueryResult extends PgQueryResultHKT>(
  database: PublicNewsDatabase<TQueryResult>,
  mediaBaseUrl: string,
) {
  const rows = await database
    .select()
    .from(publishedArticles)
    .orderBy(desc(publishedArticles.publishedAt));
  return rows.map((row) => mapPublishedArticle(row, mediaBaseUrl));
}

export async function getPublishedNewsBySlug<
  TQueryResult extends PgQueryResultHKT,
>(
  database: PublicNewsDatabase<TQueryResult>,
  slug: string,
  mediaBaseUrl: string,
) {
  const parsedSlug = newsArticleSchema.shape.slug.parse(slug);
  const [row] = await database
    .select()
    .from(publishedArticles)
    .where(eq(publishedArticles.slug, parsedSlug))
    .limit(1);
  return row ? mapPublishedArticle(row, mediaBaseUrl) : undefined;
}
