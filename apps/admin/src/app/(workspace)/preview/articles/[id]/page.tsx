import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  ArrowLeftIcon,
  EyeIcon,
  NewsArticleBody,
  StatusBadge,
} from "@nite/cms-ui";

import {
  calculateEditorialReadTime,
  getEditorialPreviewSnapshot,
  getEditorialRevisionPreview,
} from "@nite/editorial";
import { mediaAssets } from "@nite/cms-db";
import { requireCmsPageContext } from "@/lib/auth";
import { getPublicMediaUrl } from "@/lib/media-storage";

export default async function ArticlePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string; snapshot?: string }>;
}) {
  const [{ id }, query, context] = await Promise.all([
    params,
    searchParams,
    requireCmsPageContext(),
  ]);
  const snapshotId = z.uuid().safeParse(query.snapshot);
  if (query.snapshot !== undefined && !snapshotId.success) notFound();
  const snapshot = snapshotId.success
    ? await getEditorialPreviewSnapshot(context.database, {
        articleId: id,
        snapshotId: snapshotId.data,
      })
    : undefined;
  if (snapshotId.success && !snapshot) notFound();
  const result = snapshot
    ? {
        article: { ...snapshot.article, slug: snapshot.input.slug },
        revision: {
          ...snapshot.input,
          id: snapshot.snapshot.baseRevisionId,
          version: undefined,
          readTimeMinutes: calculateEditorialReadTime(snapshot.input.body),
        },
      }
    : await getEditorialRevisionPreview(
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
    cover?.status === "ready"
      ? getPublicMediaUrl(cover.publicObjectKey)
      : undefined;

  return (
    <main className="mx-auto grid max-w-5xl gap-10 pb-20">
      <header className="-mx-4 -mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-nite-border-subtle bg-nite-surface px-4 py-4 shadow-nite-lift sm:-mx-6 sm:-mt-8 sm:px-6 lg:-mx-8 lg:-mt-10 lg:px-8">
        <Link
          href={`/articles/${result.article.id}/edit`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-nite-brand-primary outline-none hover:bg-nite-section focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Voltar ao editor
        </Link>
        <div className="flex items-center gap-2">
          <EyeIcon
            className="size-4 text-nite-text-secondary"
            aria-hidden="true"
          />
          <StatusBadge
            status="draft"
            label={
              snapshot
                ? "Preview ao vivo · expira em 10 min"
                : `Preview autenticado · revisão v${result.revision.version}`
            }
          />
        </div>
      </header>

      <article className="grid gap-10 rounded-[10px] border border-nite-border-subtle bg-nite-surface px-5 py-8 shadow-nite-lift sm:px-10 sm:py-12 lg:px-16">
        <div className="grid gap-5">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-nite-brand-accent">
            {result.revision.category || "Sem categoria"}
          </p>
          <h1 className="max-w-4xl font-editorial text-[clamp(2.5rem,6vw,4.75rem)] leading-[1.04] font-semibold tracking-[-0.035em]">
            {result.revision.title}
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-nite-text-secondary">
            {result.revision.summary || "Resumo ainda não informado."}
          </p>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-nite-text-muted">
            {result.revision.readTimeMinutes} min de leitura ·{" "}
            {result.revision.byline || "Assinatura ainda não informada"}
          </p>
        </div>

        {coverUrl ? (
          <figure>
            <div className="relative aspect-[16/7] min-h-64 overflow-hidden rounded-xl border border-nite-border-subtle bg-nite-section">
              <Image
                src={coverUrl}
                alt={result.revision.coverAlt}
                fill
                priority
                unoptimized
                sizes="(min-width: 1024px) 1024px, 100vw"
                className="object-cover"
              />
            </div>
            {result.revision.coverCaption || result.revision.coverCredit ? (
              <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-nite-text-secondary">
                {result.revision.coverCaption ? (
                  <span>{result.revision.coverCaption}</span>
                ) : null}
                {result.revision.coverCredit ? (
                  <span>{result.revision.coverCredit}</span>
                ) : null}
              </figcaption>
            ) : null}
          </figure>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-nite-border-strong bg-nite-section p-6 text-center text-nite-text-muted">
            A capa ainda não está disponível no domínio público de mídia.
          </div>
        )}

        <NewsArticleBody
          document={result.revision.body}
          className="mx-auto grid w-full max-w-3xl gap-7 text-lg leading-9 text-nite-text-secondary"
        />
      </article>
    </main>
  );
}
