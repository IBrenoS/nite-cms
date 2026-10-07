import Image from "next/image";
import Link from "next/link";
import {
  EmptyState,
  ImageIcon,
  PlusIcon,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  buttonVariants,
  cn,
} from "@nite/cms-ui";

import {
  getEditorialArticlesDashboard,
  newsCategoryValues,
  type EditorialDashboardFilters,
} from "@nite/editorial";
import { requireCmsPageContext } from "@/lib/auth";
import { getPublicMediaUrl } from "@/lib/media-storage";
import { ArticleFilters } from "@/components/article-filters";
import { ArticleRowActions } from "@/components/article-row-actions";

const articleStatuses = ["draft", "published", "archived"] as const;
type ArticleStatus = (typeof articleStatuses)[number];

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
  if (articleDay === today) return `hoje, ${time}`;
  if (articleDay === yesterday) return `ontem, ${time}`;

  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${day} ${month}, ${time}`;
}

function dashboardHref({
  status,
  search,
  category,
}: {
  status?: ArticleStatus;
  search?: string;
  category?: string;
}) {
  return {
    pathname: "/",
    query: {
      ...(status ? { status } : {}),
      ...(search ? { q: search } : {}),
      ...(category ? { category } : {}),
    },
  };
}

function articleStatusLabel(status: ArticleStatus) {
  if (status === "published") return "Publicada";
  if (status === "archived") return "Arquivada";
  return "Rascunho";
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
  const totalCount = counts.draft + counts.published + counts.archived;
  const hasRefinement = Boolean(search || category);

  const statusLinks = [
    {
      label: "Todas",
      count: totalCount,
      href: dashboardHref({ search, category }),
      active: !status,
    },
    {
      label: "Em produção",
      count: counts.draft,
      href: dashboardHref({ status: "draft", search, category }),
      active: status === "draft",
    },
    {
      label: "Publicadas",
      count: counts.published,
      href: dashboardHref({ status: "published", search, category }),
      active: status === "published",
    },
    {
      label: "Arquivadas",
      count: counts.archived,
      href: dashboardHref({ status: "archived", search, category }),
      active: status === "archived",
    },
  ];

  const currentViewLabel =
    status === "draft"
      ? "em produção"
      : status === "published"
        ? "publicada"
        : status === "archived"
          ? "arquivada"
          : undefined;

  const emptyState =
    totalCount === 0
      ? {
          title: "Nenhuma matéria por aqui",
          description:
            "Quando a redação começar uma nova história, ela aparecerá nesta lista.",
          action: (
            <Link
              href="/articles/new"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              <PlusIcon aria-hidden="true" />
              Nova matéria
            </Link>
          ),
        }
      : hasRefinement
        ? {
            title: "Nenhuma matéria corresponde aos filtros",
            description:
              "Tente outro termo de busca ou ajuste a categoria para consultar a redação.",
            action: (
              <Link
                href={dashboardHref({ status })}
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                Limpar filtros
              </Link>
            ),
          }
        : {
            title: currentViewLabel
              ? `Nenhuma matéria ${currentViewLabel}`
              : "Nenhuma matéria nesta visão",
            description:
              status === "draft"
                ? "Quando uma nova matéria for iniciada, ela aparecerá em produção."
                : "Não há conteúdo editorial nesta etapa do fluxo no momento.",
            action: undefined,
          };

  return (
    <main className="w-full space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 xl:px-10">
      {deletedMedia && /^\d+$/u.test(deletedMedia) ? (
        <p
          role="status"
          className="rounded-md border border-success-border bg-success-bg p-3 text-ui-md text-success"
        >
          Matéria excluída. Limpeza de {deletedMedia} mídias agendada.
        </p>
      ) : null}

      <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-heading-md font-semibold tracking-tight text-text-primary">
            Matérias
          </h1>
          <p className="mt-1 text-ui-md text-text-secondary">
            Acompanhe o que está em produção e o que já foi publicado.
          </p>
        </div>
        <Link
          className={cn(
            buttonVariants({ variant: "primary", size: "lg" }),
            "max-sm:h-11",
          )}
          href="/articles/new"
        >
          <PlusIcon aria-hidden="true" />
          <span>Nova matéria</span>
        </Link>
      </header>

      <section aria-label="Visões e filtros de matérias" className="space-y-4">
        <nav
          aria-label="Visões editoriais"
          className="border-b border-border-subtle"
        >
          <div className="grid grid-cols-4 items-stretch sm:flex sm:min-w-max sm:items-center sm:gap-6">
            {statusLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-label={`${item.label} ${item.count}`}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-0.5 text-ui-sm font-semibold transition-colors [transition-duration:var(--motion-duration-normal)] sm:gap-2 sm:text-ui-md",
                  item.active
                    ? "border-primary text-primary"
                    : "border-transparent text-text-secondary hover:border-border-strong hover:text-text-primary",
                )}
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    "font-mono text-ui-xs",
                    item.active ? "text-primary" : "text-text-muted",
                  )}
                >
                  {item.count}
                </span>
              </Link>
            ))}
          </div>
        </nav>

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
          Índice editorial de matérias
        </h2>

        {records.length === 0 ? (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description}
            action={emptyState.action}
            className="min-h-56 justify-center sm:max-w-2xl"
          />
        ) : (
          <>
            <div className="hidden overflow-hidden border-y border-border-subtle bg-surface sm:rounded-lg sm:border editor-stack:block">
              <Table>
                <TableHeader className="sr-only">
                  <TableRow>
                    <TableHead>Matéria</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(({ article, revision, cover }, index) => {
                    const title = revision?.title ?? "Rascunho sem revisão";
                    const coverUrl =
                      cover?.status === "ready"
                        ? getPublicMediaUrl(cover.publicObjectKey)
                        : undefined;
                    const statusLabel = articleStatusLabel(article.status);
                    return (
                      <TableRow key={article.id} className="h-14 min-h-14">
                        <TableCell className="py-4">
                          <div className="flex min-w-0 items-start gap-4">
                            <div className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-surface-subtle text-text-secondary">
                              {coverUrl ? (
                                <Image
                                  src={coverUrl}
                                  alt={revision?.coverAlt || ""}
                                  width={80}
                                  height={48}
                                  unoptimized
                                  priority={index === 0}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageIcon
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/articles/${article.id}/edit`}
                                className="block truncate font-editorial text-ui-lg font-semibold text-text-primary transition-colors [transition-duration:var(--motion-duration-normal)] hover:text-primary"
                              >
                                {title}
                              </Link>
                              <p className="mt-0.5 truncate text-ui-sm text-text-secondary">
                                {revision?.summary ||
                                  "Resumo ainda não informado."}
                              </p>
                              <p className="mt-1.5 flex min-w-0 items-center gap-2 text-ui-sm text-text-muted">
                                <span>
                                  {categoryLabel(revision?.category ?? "")}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  Atualizada{" "}
                                  {formatUpdatedAt(article.updatedAt)}
                                </span>
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-[132px] py-4 align-top">
                          <StatusBadge
                            status={
                              article.status === "published"
                                ? "published"
                                : article.status
                            }
                            tone={
                              article.status === "archived"
                                ? "quiet"
                                : undefined
                            }
                            label={statusLabel}
                          />
                        </TableCell>
                        <TableCell className="w-[56px] py-3 text-right align-top">
                          <ArticleRowActions articleId={article.id} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-hidden border-y border-border-subtle bg-surface sm:rounded-lg sm:border editor-stack:hidden">
              {records.map(({ article, revision, cover }, index) => {
                const title = revision?.title ?? "Rascunho sem revisão";
                const coverUrl =
                  cover?.status === "ready"
                    ? getPublicMediaUrl(cover.publicObjectKey)
                    : undefined;
                const statusLabel = articleStatusLabel(article.status);
                return (
                  <article
                    key={article.id}
                    aria-label={title}
                    className={cn(
                      "p-4",
                      index < records.length - 1 &&
                        "border-b border-border-subtle",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-surface-subtle text-text-secondary">
                        {coverUrl ? (
                          <Image
                            src={coverUrl}
                            alt={revision?.coverAlt || ""}
                            width={80}
                            height={56}
                            unoptimized
                            priority={index === 0}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="size-4" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/articles/${article.id}/edit`}
                          className="line-clamp-2 font-editorial text-ui-lg font-semibold text-text-primary"
                        >
                          {title}
                        </Link>
                        <p className="mt-1 line-clamp-2 text-ui-sm text-text-secondary">
                          {revision?.summary || "Resumo ainda não informado."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui-sm text-text-muted">
                          <span>{categoryLabel(revision?.category ?? "")}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Atualizada {formatUpdatedAt(article.updatedAt)}
                          </span>
                        </p>
                        <div className="mt-2">
                          <StatusBadge
                            status={
                              article.status === "published"
                                ? "published"
                                : article.status
                            }
                            tone={
                              article.status === "archived"
                                ? "quiet"
                                : undefined
                            }
                            label={statusLabel}
                          />
                        </div>
                      </div>
                      <ArticleRowActions articleId={article.id} />
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
