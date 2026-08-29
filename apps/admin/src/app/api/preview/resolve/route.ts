import { and, eq, inArray } from "drizzle-orm";

import { articleRevisions, articles, mediaAssets } from "@nite/cms-db";
import { getDatabase } from "@nite/cms-db/database";
import { readAdminConfiguration } from "@/lib/auth-config";
import { getPublicMediaUrl } from "@/lib/media-storage";
import { readPreviewConfiguration } from "@/lib/preview-config";
import { resolvePreviewRequest } from "@/lib/preview-resolver";
import { PreviewTokenError, verifyPreviewToken } from "@/lib/preview-token";

const privateHeaders = { "Cache-Control": "private, no-store" };

function response(body: object, status: number) {
  return Response.json(body, { status, headers: privateHeaders });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length).trim();
  return token || undefined;
}

export async function POST(request: Request) {
  const preview = readPreviewConfiguration(process.env);
  if (!preview.configured) {
    return response({ error: "preview_unavailable" }, 503);
  }
  const admin = readAdminConfiguration(process.env);
  if (!admin.configured) return response({ error: "preview_unavailable" }, 503);
  const database = getDatabase(admin.configuration);

  return resolvePreviewRequest(request, {
    getClaims: (input) => {
      const token = getBearerToken(input);
      if (!token) return undefined;
      try {
        return verifyPreviewToken(token, preview.configuration.hmacSecret);
      } catch (error) {
        if (error instanceof PreviewTokenError) return undefined;
        return undefined;
      }
    },
    async findRevision(claims) {
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
      return result;
    },
    async findMedia(ids) {
      if (ids.length === 0) return [];
      const assets = await database
        .select()
        .from(mediaAssets)
        .where(inArray(mediaAssets.id, ids));
      return assets.flatMap((asset) =>
        asset.status === "ready" &&
        asset.publicObjectKey &&
        asset.width &&
        asset.height
          ? [
              {
                id: asset.id,
                status: "ready" as const,
                publicObjectKey: asset.publicObjectKey,
                width: asset.width,
                height: asset.height,
              },
            ]
          : [],
      );
    },
    getPublicMediaUrl,
  });
}
