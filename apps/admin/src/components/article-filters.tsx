"use client";

import type { ChangeEvent, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "@nite/cms-ui";

type ArticleFiltersProps = {
  search?: string;
  status?: "draft" | "published" | "archived";
  category?: string;
  categories: ReadonlyArray<{ value: string; label: string }>;
};

type FilterFieldsProps = ArticleFiltersProps & {
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  mobile?: boolean;
};

function FilterFields({
  status,
  category,
  categories,
  onChange,
  mobile = false,
}: FilterFieldsProps) {
  return (
    <>
      <label className={mobile ? "grid gap-1.5 text-sm font-medium" : "w-auto"}>
        <span className={mobile ? undefined : "sr-only"}>
          Filtrar por estado
        </span>
        <select
          name="status"
          aria-label="Filtrar por estado"
          defaultValue={status ?? ""}
          onChange={onChange}
          className="min-h-10 rounded-md border border-nite-border-subtle bg-nite-surface px-3 text-sm text-nite-text-primary focus:border-nite-brand-primary focus:outline-none focus:ring-2 focus:ring-nite-brand-primary/15"
        >
          <option value="">Todos os estados</option>
          <option value="draft">Rascunho</option>
          <option value="published">Publicado</option>
          <option value="archived">Arquivado</option>
        </select>
      </label>
      <label className={mobile ? "grid gap-1.5 text-sm font-medium" : "w-auto"}>
        <span className={mobile ? undefined : "sr-only"}>
          Filtrar por categoria
        </span>
        <select
          name="category"
          aria-label="Filtrar por categoria"
          defaultValue={category ?? ""}
          onChange={onChange}
          className="min-h-10 rounded-md border border-nite-border-subtle bg-nite-surface px-3 text-sm text-nite-text-primary focus:border-nite-brand-primary focus:outline-none focus:ring-2 focus:ring-nite-brand-primary/15"
        >
          <option value="">Todas as categorias</option>
          {categories.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function SearchField({
  search,
  inputRef,
}: {
  search?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="relative block min-w-0 flex-1 sm:w-72 sm:flex-initial">
      <span className="sr-only">Buscar por título ou slug</span>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-nite-text-secondary"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={search}
        placeholder="Buscar por título ou slug"
        className="min-h-10 w-full rounded-md border border-nite-border-subtle bg-nite-surface pr-3 pl-9 text-sm text-nite-text-primary placeholder:text-nite-text-secondary focus:border-nite-brand-primary focus:outline-none focus:ring-2 focus:ring-nite-brand-primary/15"
      />
    </label>
  );
}

export function ArticleFilters(props: ArticleFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function applySelectFilter(event: ChangeEvent<HTMLSelectElement>) {
    event.currentTarget.form?.requestSubmit();
  }

  function closeFilters() {
    setFiltersOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!filtersOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setFiltersOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [filtersOpen]);

  return (
    <>
      <form
        action="/"
        className="flex w-full min-w-0 items-center gap-2 min-[1480px]:w-auto"
        role="search"
      >
        <SearchField search={props.search} />
        <div className="hidden sm:contents">
          <FilterFields {...props} onChange={applySelectFilter} />
        </div>
        <button type="submit" className="sr-only">
          Aplicar filtros
        </button>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Abrir filtros"
          onClick={() => setFiltersOpen(true)}
          className="flex size-11 shrink-0 items-center justify-center rounded-md border border-nite-border-subtle bg-nite-surface text-nite-text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nite-brand-primary"
        >
          <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
        </button>
      </form>

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/35 sm:hidden"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeFilters();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros de matérias"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeFilters();
            }}
            className="w-full rounded-t-xl border border-nite-border-subtle bg-nite-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-nite-text-primary">
                  Filtros
                </h2>
                <p className="text-sm text-nite-text-secondary">
                  Refine a central de matérias.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar filtros"
                onClick={closeFilters}
                className="flex size-11 items-center justify-center rounded-md text-nite-text-secondary hover:bg-nite-section"
              >
                <XIcon className="size-5" aria-hidden="true" />
              </button>
            </div>
            <form action="/" className="grid gap-4">
              {props.search ? (
                <input type="hidden" name="q" value={props.search} />
              ) : null}
              <FilterFields {...props} mobile />
              <button
                type="submit"
                className="min-h-11 rounded-md bg-nite-brand-primary px-4 text-sm font-semibold text-white"
              >
                Aplicar filtros
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
