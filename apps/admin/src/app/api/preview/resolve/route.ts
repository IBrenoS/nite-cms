import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { resolveEditorialDocumentMedia } from "@nite/editorial";
import { articleRevisions, articles, mediaAssets } from "@nite/cms-db";
import { getDatabase } from "@nite/cms-db/database";
import { readAdminConfiguration } from "@/lib/auth-config";
import { getPublicMediaUrl } from "@/lib/media-storage";
import { readPreviewConfiguration } from "@/lib/preview-config";
import { PreviewTokenError, verifyPreviewToken } from "@/lib/preview-token";

const privateHeaders = { "Cache-Control": "private, no-store" };

function response(body: object, status: number) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length).trim();
  return token || undefined;
}

export async function POST(request: Request) {
  const preview = readPreviewConfiguration(process.env);
  if (!preview.configured)
    return response({ error: "preview_unavailable" }, 503);
  const token = getBearerToken(request);
  if (!token) return response({ error: "unauthorized" }, 401);

  let claims: ReturnType<typeof verifyPreviewToken>;
  try {
    claims = verifyPreviewToken(token, preview.configuration.hmacSecret);
  } catch (error) {
    if (error instanceof PreviewTokenError)
      return response({ error: "unauthorized" }, 401);
    return response({ error: "unauthorized" }, 401);
  }

  const admin = readAdminConfiguration(process.env);
  if (!admin.configured) return response({ error: "preview_unavailable" }, 503);
  const database = getDatabase(admin.configuration);
  const [result] = await database
    .select({ article: articles, revision: articleRevisions })
    .from(articles)
    .innerJoin(
      articleRevisions,
      and(
        eq(articleRevisions.id, claims.revisionId),
        eq(articleRevisions.articleId, articles.id),
      ),
    )
    .where(eq(articles.id, claims.articleId))
    .limit(1);
  if (!result) return response({ error: "not_found" }, 404);

  const document = result.revision.body;
  const mediaIds = new Set<string>();
  const collectMediaIds = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const value = node as {
      type?: string;
      attrs?: { mediaId?: unknown };
      content?: unknown[];
    };
    if (value.type === "image" && typeof value.attrs?.mediaId === "string")
      mediaIds.add(value.attrs.mediaId);
    value.content?.forEach(collectMediaIds);
  };
  collectMediaIds(document);
  const allMediaIds = [
    ...mediaIds,
    ...(result.revision.coverMediaId ? [result.revision.coverMediaId] : []),
  ];
  const media = allMediaIds.length
    ? await database
        .select()
        .from(mediaAssets)
        .where(inArray(mediaAssets.id, allMediaIds))
    : [];
  const readyMedia = media.filter(
    (asset) =>
      asset.status === "ready" &&
      asset.publicObjectKey &&
      asset.width &&
      asset.height,
  );
  if (readyMedia.length !== allMediaIds.length)
    return response({ error: "media_not_ready" }, 409);
  const resolvedMedia: Record<
    string,
    { src: string; width: number; height: number }
  > = {};
  for (const asset of readyMedia) {
    const src = getPublicMediaUrl(asset.publicObjectKey);
    if (!src) return response({ error: "media_unavailable" }, 503);
    resolvedMedia[asset.id] = {
      src,
      width: asset.width!,
      height: asset.height!,
    };
  }
  const cover = result.revision.coverMediaId
    ? resolvedMedia[result.revision.coverMediaId]
    : undefined;
  try {
    return response(
      {
        schemaVersion: 1,
        articleId: result.article.id,
        revisionId: result.revision.id,
        slug: result.article.slug,
        title: result.revision.title,
        summary: result.revision.summary,
        category: result.revision.category,
        eventDate: result.revision.eventDate,
        readTimeMinutes: result.revision.readTimeMinutes,
        byline: result.revision.byline,
        featured: result.revision.featured,
        cover: cover ? { ...cover, alt: result.revision.coverAlt } : undefined,
        body: resolveEditorialDocumentMedia(document, resolvedMedia),
        seo: result.revision.seo,
      },
      200,
    );
  } catch {
    return response({ error: "preview_unavailable" }, 409);
  }
}
