import { z } from "zod";

import {
  editorialDocumentV1Schema,
  newsCategoryValues,
  resolveEditorialDocumentMedia,
} from "@nite/editorial";

const privateHeaders = { "Cache-Control": "private, no-store" };

const previewMediaSchema = z.object({
  id: z.uuid(),
  status: z.literal("ready"),
  publicObjectKey: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const previewArticleDtoSchema = z
  .object({
    schemaVersion: z.literal(1),
    articleId: z.uuid(),
    revisionId: z.uuid(),
    slug: z
      .string()
      .min(3)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    publishedAt: z.iso.datetime().nullable(),
    title: z.string().min(12).max(100),
    summary: z.string().min(48).max(220),
    category: z.enum(newsCategoryValues),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    readTimeMinutes: z.number().int().min(1).max(30),
    byline: z.string().min(3).max(80),
    featured: z.boolean(),
    cover: z
      .object({
        src: z.url(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        alt: z.string().min(12),
      })
      .optional(),
    body: editorialDocumentV1Schema,
    seo: z
      .object({
        title: z.string().min(20).max(60),
        description: z.string().min(80).max(160),
      })
      .optional(),
  })
  .strict();

type PreviewClaims = { articleId: string; revisionId: string };
type PreviewRevision = {
  article: { id: string; slug: string; publishedAt: Date | null };
  revision: {
    id: string;
    title: string;
    summary: string;
    category: string;
    eventDate: string | null;
    readTimeMinutes: number;
    byline: string;
    featured: boolean;
    coverMediaId: string | null;
    coverAlt: string;
    body: unknown;
    seo: unknown;
  };
};

type PreviewMedia = z.infer<typeof previewMediaSchema>;

export type PreviewResolverDependencies = {
  getClaims(request: Request): PreviewClaims | undefined;
  findRevision(claims: PreviewClaims): Promise<PreviewRevision | undefined>;
  findMedia(ids: string[]): Promise<PreviewMedia[]>;
  getPublicMediaUrl(objectKey: string): string | undefined;
};

function response(body: object, status: number) {
  return Response.json(body, { status, headers: privateHeaders });
}

function collectMediaIds(input: unknown, ids: Set<string>): void {
  if (!input || typeof input !== "object") return;
  const node = input as {
    type?: unknown;
    attrs?: { mediaId?: unknown };
    content?: unknown[];
  };
  if (node.type === "image" && typeof node.attrs?.mediaId === "string") {
    ids.add(node.attrs.mediaId);
  }
  node.content?.forEach((child) => collectMediaIds(child, ids));
}

export async function resolvePreviewRequest(
  request: Request,
  dependencies: PreviewResolverDependencies,
) {
  const claims = dependencies.getClaims(request);
  if (!claims) return response({ error: "unauthorized" }, 401);
  const result = await dependencies.findRevision(claims);
  if (!result) return response({ error: "not_found" }, 404);

  const mediaIds = new Set<string>();
  collectMediaIds(result.revision.body, mediaIds);
  if (result.revision.coverMediaId) mediaIds.add(result.revision.coverMediaId);
  const assets = (await dependencies.findMedia([...mediaIds])).map((asset) =>
    previewMediaSchema.parse(asset),
  );
  if (assets.length !== mediaIds.size)
    return response({ error: "media_not_ready" }, 409);

  const resolvedMedia: Record<
    string,
    { src: string; width: number; height: number }
  > = {};
  for (const asset of assets) {
    const src = dependencies.getPublicMediaUrl(asset.publicObjectKey);
    if (!src) return response({ error: "media_unavailable" }, 503);
    resolvedMedia[asset.id] = { src, width: asset.width, height: asset.height };
  }

  const cover = result.revision.coverMediaId
    ? resolvedMedia[result.revision.coverMediaId]
    : undefined;
  try {
    const dto = previewArticleDtoSchema.parse({
      schemaVersion: 1,
      articleId: result.article.id,
      revisionId: result.revision.id,
      slug: result.article.slug,
      publishedAt: result.article.publishedAt?.toISOString() ?? null,
      title: result.revision.title,
      summary: result.revision.summary,
      category: result.revision.category,
      ...(result.revision.eventDate
        ? { eventDate: result.revision.eventDate }
        : {}),
      readTimeMinutes: result.revision.readTimeMinutes,
      byline: result.revision.byline,
      featured: result.revision.featured,
      ...(cover ? { cover: { ...cover, alt: result.revision.coverAlt } } : {}),
      body: resolveEditorialDocumentMedia(result.revision.body, resolvedMedia),
      ...(result.revision.seo ? { seo: result.revision.seo } : {}),
    });
    return response(dto, 200);
  } catch {
    return response({ error: "preview_unavailable" }, 409);
  }
}
