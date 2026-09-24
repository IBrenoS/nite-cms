import Image from "next/image";
import Link from "next/link";
import { ImageIcon, PlusIcon, StatusBadge } from "@nite/cms-ui";

import {
  getEditorialArticlesDashboard,
  newsCategoryValues,
  type EditorialDashboardFilters,
} from "@nite/editorial";
import { requireCmsPageContext } from "@/lib/auth";
import { getPublicMediaUrl } from "@/lib/media-storage";
import { ArticleFilters } from "@/components/article-filters";

const articleStatuses = ["draft", "published", "archived"] as const;

type DashboardSearchParams = {
  q?: string | string[];
  status?: string | string[];
  category?: string | string[];
  deletedMedia?: string | string[];
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function categoryLabel(value: string) {
  switch (value) {
    case "agenda":
      return "Agenda";
    case "comunidade":
      return "Comunidade";
    case "projetos":
      return "Projetos";
    case "inovacao":
      return "Inovação";
    case "cultura":
      return "Cultura";
    case "tecnologia":
      return "Tecnologia";
    default:
      return "Sem categoria";
  }
}

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function formatUpdatedAt(date: Date, now = new Date()) {
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const today = dateKey(now);
  const yesterday = dateKey(new Date(now.getTime() - 86_400_000));
  const articleDay = dateKey(date);
  if (articleDay === today) return `Hoje, ${time}`;
  if (articleDay === yesterday) return `Ontem, ${time}`;

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${day} ${month}, ${time}`;
}

export default async function DashboardPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<DashboardSearchParams>;
} = {}) {
  const [context, rawSearchParams] = await Promise.all([
    requireCmsPageContext(),
    searchParams,
  ]);
  const search =
    firstQueryValue(rawSearchParams.q)?.trim().slice(0, 120) || undefined;
  const rawStatus = firstQueryValue(rawSearchParams.status);
  const status = articleStatuses.find((value) => value === rawStatus);
  const rawCategory = firstQueryValue(rawSearchParams.category);
  const category = newsCategoryValues.find((value) => value === rawCategory);
  const filters: EditorialDashboardFilters = { search, status, category };
  const deletedMedia = firstQueryValue(rawSearchParams.deletedMedia);
  const { counts, records } = await getEditorialArticlesDashboard(
    context.database,
    context.membership,
    filters,
  );
  const resultLabel = `${records.length} ${records.length === 1 ? "matéria encontrada" : "matérias encontradas"}`;

  return (
    <main className="w-full space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 xl:px-10">
      {deletedMedia && /^\d+$/u.test(deletedMedia) ? (
        <p
          role="status"
          className="rounded-md border border-status-done/30 bg-status-done/5 p-3 text-sm text-status-done"
        >
          Matéria excluída. Limpeza de {deletedMedia} mídias agendada.
        </p>
      ) : null}
      <header className="flex flex-col gap-4 border-b border-nite-border-subtle pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-nite-text-primary">
            Matérias
          </h1>
          <p className="mt-1 text-sm text-nite-text-secondary">{resultLabel}</p>
        </div>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-nite-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 max-sm:min-h-11"
          href="/articles/new"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          <span>Nova matéria</span>
        </Link>
      </header>

      <section
        role="region"
        aria-label="Resumo das matérias"
        className="grid gap-4 min-[1480px]:grid-cols-[minmax(0,1fr)_auto] min-[1480px]:items-center"
      >
        <div className="grid grid-cols-2 gap-1 min-[560px]:flex min-[560px]:flex-nowrap min-[560px]:items-center">
          <Link
            href="/"
            className={`inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-sm transition-colors min-[560px]:w-auto min-[560px]:justify-start ${!status ? "bg-nite-section text-nite-brand-primary font-semibold" : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary font-medium"}`}
          >
            <span>Todas</span>
            <span className="font-mono text-xs text-nite-text-muted">
              {counts.draft + counts.published + counts.archived}
            </span>
          </Link>
          <Link
            href="/?status=draft"
            className={`inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-sm transition-colors min-[560px]:w-auto min-[560px]:justify-start ${status === "draft" ? "bg-nite-section text-nite-brand-primary font-semibold" : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary font-medium"}`}
          >
            <span>Rascunhos</span>
            <span className="font-mono text-xs text-nite-text-muted">
              {counts.draft}
            </span>
          </Link>
          <Link
            href="/?status=published"
            className={`inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-sm transition-colors min-[560px]:w-auto min-[560px]:justify-start ${status === "published" ? "bg-nite-section text-nite-brand-primary font-semibold" : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary font-medium"}`}
          >
            <span>Publicadas</span>
            <span className="font-mono text-xs text-nite-text-muted">
              {counts.published}
            </span>
          </Link>
          <Link
            href="/?status=archived"
            className={`inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-sm transition-colors min-[560px]:w-auto min-[560px]:justify-start ${status === "archived" ? "bg-nite-section text-nite-brand-primary font-semibold" : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary font-medium"}`}
          >
            <span>Arquivadas</span>
            <span className="font-mono text-xs text-nite-text-muted">
              {counts.archived}
            </span>
          </Link>
        </div>

        <ArticleFilters
          search={search}
          status={status}
          category={category}
          categories={newsCategoryValues.map((value) => ({
            value,
            label: categoryLabel(value),
          }))}
        />
      </section>

      <section aria-labelledby="editorial-list-title">
        <h2 id="editorial-list-title" className="sr-only">
          Fila editorial
        </h2>

        <div className="overflow-hidden rounded-lg border border-nite-border-subtle bg-nite-surface">
          <div className="hidden min-[860px]:grid grid-cols-[minmax(280px,1fr)_120px_116px_76px_140px_80px] items-center gap-4 border-b border-nite-border-subtle bg-nite-section/60 px-5 py-2.5 text-xs font-semibold tracking-wide text-nite-text-secondary uppercase">
            <span>Matéria</span>
            <span>Categoria</span>
            <span>Estado</span>
            <span>Revisão</span>
            <span>Atualização</span>
            <span className="text-right">Ação</span>
          </div>

          {records.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-semibold text-nite-text-primary">
                Nenhuma matéria encontrada
              </p>
              <p className="mt-1 text-sm text-nite-text-secondary">
                Ajuste a busca ou os filtros para consultar outra parte da fila.
              </p>
            </div>
          ) : (
            records.map(({ article, revision, cover }, index) => {
              const title = revision?.title ?? "Rascunho sem revisão";
              const titleId = `article-title-${article.id}`;
              const coverUrl =
                cover?.status === "ready"
                  ? getPublicMediaUrl(cover.publicObjectKey)
                  : undefined;
              const statusLabel =
                article.status === "published"
                  ? "Publicado"
                  : article.status === "draft"
                    ? "Rascunho"
                    : "Arquivado";
              return (
                <article
                  key={article.id}
                  aria-labelledby={titleId}
                  className={`p-4 min-[860px]:grid min-[860px]:min-h-16 min-[860px]:grid-cols-[minmax(280px,1fr)_120px_116px_76px_140px_80px] min-[860px]:items-center min-[860px]:gap-4 min-[860px]:px-5 min-[860px]:py-2.5 transition-colors hover:bg-nite-section/30 ${
                    index < records.length - 1
                      ? "border-b border-nite-border-subtle"
                      : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-nite-border-subtle bg-nite-section text-nite-text-secondary">
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={revision?.coverAlt || ""}
                          width={44}
                          height={32}
                          unoptimized
                          priority={index === 0}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        id={titleId}
                        className="truncate text-[15px] font-semibold leading-5 text-nite-text-primary"
                      >
                        {title}
                      </h3>
                      <p className="mt-0.5 truncate text-[13px] text-nite-text-secondary">
                        {revision?.summary || "Resumo ainda não informado."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-nite-text-secondary min-[860px]:contents">
                    <div className="flex flex-wrap items-center gap-2 min-[860px]:contents">
                      <p className="text-[13px] text-nite-text-secondary">
                        <span className="mr-1.5 font-semibold text-nite-text-primary min-[860px]:hidden">
                          Categoria:
                        </span>
                        {categoryLabel(revision?.category ?? "")}
                      </p>
                      <span className="text-nite-border-strong min-[860px]:hidden">
                        ·
                      </span>
                      <div>
                        <StatusBadge
                          status={
                            article.status === "published"
                              ? "done"
                              : article.status
                          }
                          tone={
                            article.status === "archived" ? "quiet" : undefined
                          }
                          variant="outline"
                          label={statusLabel}
                        />
                      </div>
                      <span className="text-nite-border-strong min-[860px]:hidden">
                        ·
                      </span>
                      <p className="font-mono text-[13px] text-nite-text-secondary">
                        <span className="mr-1.5 font-sans font-semibold text-nite-text-primary min-[860px]:hidden">
                          Revisão:
                        </span>
                        {revision ? `v${revision.version}` : "—"}
                      </p>
                      <span className="text-nite-border-strong min-[860px]:hidden">
                        ·
                      </span>
                      <p className="text-[13px] text-nite-text-secondary">
                        <span className="mr-1.5 font-semibold text-nite-text-primary min-[860px]:hidden">
                          Atualização:
                        </span>
                        {formatUpdatedAt(article.updatedAt)}
                      </p>
                    </div>

                    <div className="min-[860px]:flex min-[860px]:justify-end">
                      <Link
                        href={`/articles/${article.id}/edit`}
                        className="inline-flex min-h-10 items-center justify-center rounded-md border border-nite-border-subtle px-3 text-sm font-semibold text-nite-text-primary transition-colors hover:border-nite-border-hover hover:bg-nite-section max-[859px]:min-h-11"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
