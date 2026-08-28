import { createHash } from "node:crypto";

import type { NewsArticle } from "@nite/editorial";

export const PUBLIC_NEWS_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=86400";

function createEtag(body: string) {
  return `"${createHash("sha256").update(body).digest("hex")}"`;
}

function createVersionedResponse(
  payload:
    | { version: 1; articles: NewsArticle[] }
    | {
        version: 1;
        article: NewsArticle;
      },
  ifNoneMatch?: string,
) {
  const body = JSON.stringify(payload);
  const etag = createEtag(body);
  const headers = {
    "cache-control": PUBLIC_NEWS_CACHE_CONTROL,
    "content-type": "application/json; charset=utf-8",
    etag,
  };

  return ifNoneMatch === etag
    ? new Response(null, { status: 304, headers })
    : new Response(body, { status: 200, headers });
}

export function createListResponse(
  articles: NewsArticle[],
  ifNoneMatch?: string,
) {
  return createVersionedResponse({ version: 1, articles }, ifNoneMatch);
}

export function createArticleResponse(
  article: NewsArticle | undefined,
  ifNoneMatch?: string,
) {
  if (!article) {
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: { "cache-control": PUBLIC_NEWS_CACHE_CONTROL } },
    );
  }
  return createVersionedResponse({ version: 1, article }, ifNoneMatch);
}
