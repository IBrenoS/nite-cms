import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import {
  editorialDraftInputSchema,
  getEditorialArticle,
  listEditorialRevisions,
} from "@nite/editorial";
import { mediaAssets } from "@nite/cms-db";
import { ArticleEditor } from "@/components/article-editor";
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
  const [revisions, coverRecords] = await Promise.all([
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
  ]);
  const cover = coverRecords[0];
  const coverUrl =
    cover?.status === "ready"
      ? getPublicMediaUrl(cover.publicObjectKey)
      : undefined;

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
    <main>
      <ArticleEditor
        canPublish
        canDelete={context.membership.role === "admin"}
        revisions={revisions}
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
