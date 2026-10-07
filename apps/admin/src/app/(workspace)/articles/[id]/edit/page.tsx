import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";

import {
  editorialDraftInputSchema,
  getEditorialArticle,
  getEditorialMediaIds,
  listEditorialRevisions,
} from "@nite/editorial";
import { mediaAssets } from "@nite/cms-db";
import { ArticleEditor } from "@/components/article-editor";
import type { EditorMediaMap } from "@/components/editor/node-view-context";
import { requireCmsPageContext } from "@/lib/auth";
import { getPublicMediaUrl } from "@/lib/media-storage";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireCmsPageContext();
  const result = await getEditorialArticle(
    context.database,
    context.membership,
    id,
  );
  if (!result?.revision) notFound();

  const bodyMediaIds = getEditorialMediaIds(result.revision.body);
  const [revisions, coverRecords, bodyMediaRecords] = await Promise.all([
    listEditorialRevisions(
      context.database,
      context.membership,
      result.article.id,
    ),
    result.revision.coverMediaId
      ? context.database
          .select({
            publicObjectKey: mediaAssets.publicObjectKey,
            status: mediaAssets.status,
          })
          .from(mediaAssets)
          .where(eq(mediaAssets.id, result.revision.coverMediaId))
          .limit(1)
      : Promise.resolve([]),
    bodyMediaIds.length > 0
      ? context.database
          .select({
            id: mediaAssets.id,
            mediaKind: mediaAssets.mediaKind,
            publicObjectKey: mediaAssets.publicObjectKey,
            status: mediaAssets.status,
            width: mediaAssets.width,
            height: mediaAssets.height,
            durationMs: mediaAssets.durationMs,
          })
          .from(mediaAssets)
          .where(inArray(mediaAssets.id, bodyMediaIds))
      : Promise.resolve([]),
  ]);

  const cover = coverRecords[0];
  const coverUrl =
    cover?.status === "ready"
      ? getPublicMediaUrl(cover.publicObjectKey)
      : undefined;

  const bodyMedia = bodyMediaRecords.reduce<EditorMediaMap>((map, media) => {
    if (media.status !== "ready") return map;
    map[media.id] = {
      mediaKind: media.mediaKind,
      src: getPublicMediaUrl(media.publicObjectKey),
      width: media.width ?? undefined,
      height: media.height ?? undefined,
      durationSeconds:
        media.durationMs === null ? undefined : media.durationMs / 1000,
    };
    return map;
  }, {});

  const input = editorialDraftInputSchema.parse({
    slug: result.article.slug,
    title: result.revision.title,
    summary: result.revision.summary,
    category: result.revision.category,
    eventDate: result.revision.eventDate ?? undefined,
    byline: result.revision.byline,
    coverMediaId: result.revision.coverMediaId,
    coverAlt: result.revision.coverAlt,
    coverCaption: result.revision.coverCaption ?? undefined,
    coverCredit: result.revision.coverCredit ?? undefined,
    featured: result.revision.featured,
    body: result.revision.body,
    seo: result.revision.seo ?? undefined,
  });

  return (
    <main className="inspector-rail:fixed inspector-rail:inset-y-0 inspector-rail:right-0 inspector-rail:left-[var(--workspace-sidebar-width)] inspector-rail:overflow-hidden">
      <ArticleEditor
        canPublish
        canDelete={context.membership.role === "admin"}
        revisions={revisions}
        initialBodyMedia={bodyMedia}
        initial={{
          ...input,
          articleId: result.article.id,
          revisionId: result.revision.id,
          version: result.revision.version,
          status: result.article.status,
          publishedRevisionId: result.article.publishedRevisionId,
          slugManuallyEdited: result.article.slugManuallyEdited,
          slugLocked: result.article.publishedAt !== null,
          coverUrl,
        }}
      />
    </main>
  );
}
