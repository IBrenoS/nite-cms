import { desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";

import { publishedArticles, type PublishedArticleRow } from "@nite/cms-db";
import { newsArticleSchema, type NewsArticle } from "./article-schema";
import {
  resolveEditorialDocumentMedia,
  type EditorialPublicMedia,
} from "./editor-document";

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
  const bodyMedia: EditorialPublicMedia = Object.fromEntries(
    Object.entries(row.bodyMedia).map(([mediaId, media]) => {
      const src = buildPublicMediaUrl(mediaBaseUrl, media.objectKey);
      if (media.mediaKind === "captions") {
        if (media.mimeType !== "text/vtt") {
          throw new Error("A legenda pública possui MIME incompatível.");
        }
        return [
          mediaId,
          { mediaKind: "captions", src, mimeType: media.mimeType },
        ];
      }
      if (media.width === undefined || media.height === undefined) {
        throw new Error("A mídia pública não possui dimensões válidas.");
      }
      if (media.mediaKind === "video") {
        if (media.mimeType !== "video/mp4" || media.durationMs === undefined) {
          throw new Error("O vídeo público possui metadados incompatíveis.");
        }
        return [
          mediaId,
          {
            mediaKind: "video",
            src,
            mimeType: media.mimeType,
            width: media.width,
            height: media.height,
            durationSeconds: media.durationMs / 1000,
          },
        ];
      }
      return [
        mediaId,
        {
          mediaKind: "image",
          src,
          width: media.width,
          height: media.height,
        },
      ];
    }),
  );

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
      ...(row.coverCaption ? { caption: row.coverCaption } : {}),
      ...(row.coverCredit ? { credit: row.coverCredit } : {}),
    },
    featured: row.featured,
    contentState: row.contentState,
    public: row.public,
    body: resolveEditorialDocumentMedia(row.body, bodyMedia),
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
