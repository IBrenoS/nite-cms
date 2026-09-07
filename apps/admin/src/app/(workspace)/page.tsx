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
  const { counts, records } = await getEditorialArticlesDashboard(
    context.database,
    context.membership,
    filters,
  );
  const resultLabel = `${records.length} ${records.length === 1 ? "matéria encontrada" : "matérias encontradas"}`;

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-nite-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-nite-text-primary">
            Matérias
          </h1>
          <p className="mt-0.5 text-xs text-nite-text-secondary">
            {resultLabel}
          </p>
        </div>
        <Link
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-nite-brand-primary px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-800"
          href="/articles/new"
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
          <span>Nova matéria</span>
        </Link>
      </header>

      <section
        role="region"
        aria-label="Resumo das matérias"
        className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${!status ? "bg-nite-section text-nite-brand-primary font-semibold" : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary font-medium"}`}
          >
            <span>Todas</span>
            <span className="font-mono text-[11px] text-nite-text-muted">
              {counts.draft + counts.published + counts.archived}
            </span>
          </Link>
          <Link
            href="/?status=draft"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${status === "draft" ? "bg-nite-section text-nite-brand-primary font-semibold" : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary font-medium"}`}
          >
            <span>Rascunhos</span>
            <span className="font-mono text-[11px] text-nite-text-muted">
              {counts.draft}
            </span>
          </Link>
          <Link
            href="/?status=published"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${status === "published" ? "bg-nite-section text-nite-brand-primary font-semibold" : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary font-medium"}`}
          >
            <span>Publicadas</span>
            <span className="font-mono text-[11px] text-nite-text-muted">
              {counts.published}
            </span>
          </Link>
          <Link
            href="/?status=archived"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${status === "archived" ? "bg-nite-section text-nite-brand-primary font-semibold" : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary font-medium"}`}
          >
            <span>Arquivadas</span>
            <span className="font-mono text-[11px] text-nite-text-muted">
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
          <div className="hidden grid-cols-[minmax(280px,1fr)_120px_110px_70px_120px_64px] items-center gap-3 border-b border-nite-border-subtle bg-nite-section/60 px-4 py-2 text-[11px] font-semibold tracking-wider text-nite-text-secondary uppercase xl:grid">
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
              <p className="mt-1 text-xs text-nite-text-secondary">
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
                  className={`grid gap-3 p-3.5 xl:grid-cols-[minmax(280px,1fr)_120px_110px_70px_120px_64px] xl:items-center xl:px-4 xl:py-2.5 transition-colors hover:bg-nite-section/30 ${index < records.length - 1 ? "border-b border-nite-border-subtle" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-nite-border-subtle bg-nite-section text-nite-text-secondary">
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={revision?.coverAlt || ""}
                          width={44}
                          height={32}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        id={titleId}
                        className="truncate text-sm font-semibold text-nite-text-primary"
                      >
                        {title}
                      </h3>
                      <p className="truncate text-xs text-nite-text-secondary">
                        {revision?.summary || "Resumo ainda não informado."}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-nite-text-secondary">
                    <span className="mr-2 font-semibold text-nite-text-primary xl:hidden">
                      Categoria:
                    </span>
                    {categoryLabel(revision?.category ?? "")}
                  </p>
                  <div>
                    <StatusBadge
                      status={
                        article.status === "published" ? "done" : article.status
                      }
                      tone={article.status === "archived" ? "quiet" : undefined}
                      variant="outline"
                      label={statusLabel}
                    />
                  </div>
                  <p className="font-mono text-xs text-nite-text-secondary">
                    <span className="mr-2 font-sans font-semibold text-nite-text-primary xl:hidden">
                      Revisão:
                    </span>
                    {revision ? `v${revision.version}` : "—"}
                  </p>
                  <p className="text-xs text-nite-text-secondary">
                    <span className="mr-2 font-semibold text-nite-text-primary xl:hidden">
                      Atualização:
                    </span>
                    {formatUpdatedAt(article.updatedAt)}
                  </p>
                  <Link
                    href={`/articles/${article.id}/edit`}
                    className="inline-flex min-h-8 items-center justify-center rounded-md border border-nite-border-subtle px-2.5 text-xs font-semibold text-nite-text-primary transition-colors hover:bg-nite-section hover:border-nite-border-hover xl:min-h-7"
                  >
                    Editar
                  </Link>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
