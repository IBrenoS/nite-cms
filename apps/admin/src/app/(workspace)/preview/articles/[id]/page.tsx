import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { NewsArticleBody, StatusBadge } from "@nite/cms-ui";

import { getEditorialRevisionPreview } from "@nite/editorial";
import { mediaAssets } from "@nite/cms-db";
import { requireCmsPageContext } from "@/lib/auth";
import { getPublicMediaUrl } from "@/lib/media-storage";

export default async function ArticlePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const [{ id }, query, context] = await Promise.all([
    params,
    searchParams,
    requireCmsPageContext(),
  ]);
  const result = await getEditorialRevisionPreview(
    context.database,
    context.membership,
    id,
    query.revision,
  );
  if (!result) notFound();

  const [cover] = result.revision.coverMediaId
    ? await context.database
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, result.revision.coverMediaId))
        .limit(1)
    : [];
  const coverUrl =
    cover?.status === "ready" ? getPublicMediaUrl(cover.objectKey) : undefined;

  return (
    <main className="mx-auto grid max-w-5xl gap-10 pb-20">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-nite-border-subtle pb-5">
        <Link
          href={`/articles/${result.article.id}/edit`}
          className="rounded-md text-sm text-nite-brand-accent outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Voltar ao editor
        </Link>
        <StatusBadge
          status="draft"
          label={`Preview autenticado · revisão v${result.revision.version}`}
        />
      </header>

      <article className="grid gap-10">
        <div className="grid gap-5">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-nite-brand-accent">
            {result.revision.category}
          </p>
          <h1 className="max-w-4xl font-heading text-[clamp(2.5rem,6vw,4.75rem)] leading-[1.04] font-semibold tracking-[-0.035em]">
            {result.revision.title}
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-nite-text-secondary">
            {result.revision.summary}
          </p>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-nite-text-muted">
            {result.revision.readTimeMinutes} min de leitura ·{" "}
            {result.revision.byline}
          </p>
        </div>

        {coverUrl ? (
          <div className="relative aspect-[16/7] min-h-64 overflow-hidden rounded-xl border border-nite-border-subtle bg-nite-section">
            <Image
              src={coverUrl}
              alt={result.revision.coverAlt}
              fill
              priority
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-nite-border-strong bg-nite-section p-6 text-center text-nite-text-muted">
            A capa ainda não está disponível no domínio público de mídia.
          </div>
        )}

        <NewsArticleBody
          blocks={result.revision.body}
          className="mx-auto grid w-full max-w-3xl gap-7 text-lg leading-9 text-nite-text-secondary"
        />
      </article>
    </main>
  );
}
