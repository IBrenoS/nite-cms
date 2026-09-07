"use client";

import type { ChangeEvent } from "react";
import { SearchIcon } from "@nite/cms-ui";

type ArticleFiltersProps = {
  search?: string;
  status?: "draft" | "published" | "archived";
  category?: string;
  categories: ReadonlyArray<{ value: string; label: string }>;
};

export function ArticleFilters({
  search,
  status,
  category,
  categories,
}: ArticleFiltersProps) {
  function applySelectFilter(event: ChangeEvent<HTMLSelectElement>) {
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form
      action="/"
      className="flex w-full flex-wrap items-center gap-2 xl:w-auto"
      role="search"
    >
      <label className="relative block flex-1 sm:w-64 sm:flex-initial">
        <span className="sr-only">Buscar por título ou slug</span>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-nite-text-secondary"
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Buscar por título ou slug"
          className="min-h-8 w-full rounded-md border border-nite-border-subtle bg-nite-surface py-1 pr-2.5 pl-8 text-xs text-nite-text-primary placeholder:text-nite-text-secondary focus:border-nite-brand-primary focus:outline-none"
        />
      </label>
      <label className="w-auto">
        <span className="sr-only">Filtrar por estado</span>
        <select
          name="status"
          defaultValue={status ?? ""}
          onChange={applySelectFilter}
          className="min-h-8 rounded-md border border-nite-border-subtle bg-nite-surface px-2.5 py-1 text-xs text-nite-text-primary focus:border-nite-brand-primary focus:outline-none"
        >
          <option value="">Todos os estados</option>
          <option value="draft">Rascunho</option>
          <option value="published">Publicado</option>
          <option value="archived">Arquivado</option>
        </select>
      </label>
      <label className="w-auto">
        <span className="sr-only">Filtrar por categoria</span>
        <select
          name="category"
          defaultValue={category ?? ""}
          onChange={applySelectFilter}
          className="min-h-8 rounded-md border border-nite-border-subtle bg-nite-surface px-2.5 py-1 text-xs text-nite-text-primary focus:border-nite-brand-primary focus:outline-none"
        >
          <option value="">Todas as categorias</option>
          {categories.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="sr-only">
        Aplicar filtros
      </button>
    </form>
  );
}
