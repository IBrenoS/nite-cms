import Link from "next/link";
import { notFound } from "next/navigation";

import {
  editorialArticleInputSchema,
  getEditorialArticle,
  listEditorialRevisions,
} from "@nite/editorial";
import { ArticleEditor } from "@/components/article-editor";
import { requireCmsPageContext } from "@/lib/auth";

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
  const revisions = await listEditorialRevisions(
    context.database,
    context.membership,
    result.article.id,
  );

  const input = editorialArticleInputSchema.parse({
    slug: result.article.slug,
    title: result.revision.title,
    summary: result.revision.summary,
    category: result.revision.category,
    eventDate: result.revision.eventDate ?? undefined,
    readTimeMinutes: result.revision.readTimeMinutes,
    byline: result.revision.byline,
    coverMediaId: result.revision.coverMediaId,
    coverAlt: result.revision.coverAlt,
    featured: result.revision.featured,
    body: result.revision.body,
    seo: result.revision.seo ?? undefined,
  });

  return (
    <main className="grid gap-8">
      <header className="grid gap-3 border-b border-nite-border-subtle pb-7">
        <Link
          href="/"
          className="w-fit rounded-md font-mono text-xs uppercase tracking-[0.12em] text-nite-brand-accent outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Matérias
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-nite-text-muted">
              Revisão v{result.revision.version}
            </p>
            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em]">
              Editar matéria
            </h1>
          </div>
          <p className="text-sm text-nite-text-secondary">
            Cada salvamento cria um snapshot imutável.
          </p>
        </div>
      </header>
      <ArticleEditor
        canPublish={context.membership.role !== "author"}
        initial={{
          ...input,
          articleId: result.article.id,
          revisionId: result.revision.id,
          version: result.revision.version,
          status: result.article.status,
        }}
      />
      <section className="grid gap-4 border-t border-nite-border-subtle pt-8">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            Histórico de revisões
          </h2>
          <p className="mt-1 text-sm text-nite-text-secondary">
            Snapshots imutáveis; o preview abre a versão selecionada sem
            publicá-la.
          </p>
        </div>
        <ol className="grid gap-2">
          {revisions.map((revision) => (
            <li
              key={revision.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nite-border-subtle px-4 py-3"
            >
              <div>
                <p className="font-medium">v{revision.version}</p>
                <p className="text-sm text-nite-text-muted">{revision.title}</p>
              </div>
              <Link
                href={`/preview/articles/${result.article.id}?revision=${revision.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md text-sm text-nite-brand-accent outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ver revisão
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
