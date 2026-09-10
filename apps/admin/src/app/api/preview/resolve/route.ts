import { and, eq, inArray } from "drizzle-orm";

import { articleRevisions, articles, mediaAssets } from "@nite/cms-db";
import { getEditorialPreviewSnapshot } from "@nite/editorial";
import { getDatabase } from "@nite/cms-db/database";
import { readAdminConfiguration } from "@/lib/auth-config";
import { getPublicMediaUrl } from "@/lib/media-storage";
import { readPreviewConfiguration } from "@/lib/preview-config";
import {
  resolvePreviewRequest,
  type PreviewMedia,
} from "@/lib/preview-resolver";
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
      if (!("revisionId" in claims)) return undefined;
      const [result] = await database
        .select({
          article: {
            id: articles.id,
            slug: articles.slug,
            publishedAt: articles.publishedAt,
          },
          revision: articleRevisions,
        })
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
    async findSnapshot(claims) {
      if (!("snapshotId" in claims)) return undefined;
      return getEditorialPreviewSnapshot(database, claims);
    },
    async findMedia(ids) {
      if (ids.length === 0) return [];
      const assets = await database
        .select()
        .from(mediaAssets)
        .where(inArray(mediaAssets.id, ids));
      const readyAssets: PreviewMedia[] = [];
      for (const asset of assets) {
        if (asset.status !== "ready" || !asset.publicObjectKey) continue;
        if (asset.mediaKind === "captions" && asset.mimeType === "text/vtt") {
          readyAssets.push({
            id: asset.id,
            mediaKind: asset.mediaKind,
            status: "ready",
            publicObjectKey: asset.publicObjectKey,
            mimeType: asset.mimeType,
          });
          continue;
        }
        if (!asset.width || !asset.height) continue;
        if (
          asset.mediaKind === "video" &&
          asset.mimeType === "video/mp4" &&
          asset.durationMs
        ) {
          readyAssets.push({
            id: asset.id,
            mediaKind: asset.mediaKind,
            status: "ready",
            publicObjectKey: asset.publicObjectKey,
            mimeType: asset.mimeType,
            width: asset.width,
            height: asset.height,
            durationMs: asset.durationMs,
          });
          continue;
        }
        if (asset.mediaKind !== "image") continue;
        readyAssets.push({
          id: asset.id,
          mediaKind: asset.mediaKind,
          status: "ready",
          publicObjectKey: asset.publicObjectKey,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
        });
      }
      return readyAssets;
    },
    getPublicMediaUrl,
  });
}
