"use client";

import Link from "next/link";
import type { ChangeEvent, RefObject } from "react";
import { useRef, useState } from "react";
import {
  Button,
  IconButton,
  Input,
  SearchIcon,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SlidersHorizontalIcon,
  XIcon,
  buttonVariants,
} from "@nite/cms-ui";

type ArticleFiltersProps = {
  search?: string;
  status?: "draft" | "published" | "archived";
  category?: string;
  categories: ReadonlyArray<{ value: string; label: string }>;
};

type CategoryFilterProps = ArticleFiltersProps & {
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  mobile?: boolean;
};

function CategoryFilter({
  category,
  categories,
  onChange,
  mobile = false,
}: CategoryFilterProps) {
  return (
    <label
      className={mobile ? "grid gap-1.5 text-ui-md font-semibold" : "w-auto"}
    >
      <span className={mobile ? undefined : "sr-only"}>
        Filtrar por categoria
      </span>
      <Select
        name="category"
        aria-label="Filtrar por categoria"
        defaultValue={category ?? ""}
        onChange={onChange}
        className="sm:min-w-48"
      >
        <option value="">Todas as categorias</option>
        {categories.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </label>
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
    <label className="relative block min-w-0 flex-1 sm:max-w-md">
      <span className="sr-only">Buscar por título ou slug</span>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        defaultValue={search}
        placeholder="Buscar matérias"
        className="pl-9"
      />
    </label>
  );
}

function currentViewHref(status?: ArticleFiltersProps["status"]) {
  return status ? { pathname: "/", query: { status } } : "/";
}

export function ArticleFilters(props: ArticleFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasRefinement = Boolean(props.search || props.category);

  function applyCategoryFilter(event: ChangeEvent<HTMLSelectElement>) {
    event.currentTarget.form?.requestSubmit();
  }

  function setOpen(open: boolean) {
    setFiltersOpen(open);
    if (!open) window.setTimeout(() => triggerRef.current?.focus());
  }

  return (
    <Sheet open={filtersOpen} onOpenChange={setOpen}>
      <form
        action="/"
        className="flex w-full min-w-0 items-center gap-2"
        role="search"
      >
        {props.status ? (
          <input type="hidden" name="status" value={props.status} />
        ) : null}
        <SearchField search={props.search} />
        <div className="hidden sm:block">
          <CategoryFilter {...props} onChange={applyCategoryFilter} />
        </div>
        <Button type="submit" className="sr-only">
          Buscar
        </Button>
        {hasRefinement ? (
          <Link
            href={currentViewHref(props.status)}
            className={`${buttonVariants({ variant: "ghost", size: "md" })} hidden sm:inline-flex`}
          >
            Limpar filtros
          </Link>
        ) : null}
        <IconButton
          ref={triggerRef}
          type="button"
          aria-label="Abrir filtros"
          variant="secondary"
          className="size-11 sm:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
        </IconButton>
      </form>

      <SheetContent
        side="bottom"
        aria-label="Filtros de matérias"
        className="max-h-[90dvh] gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden"
      >
        <SheetHeader className="flex-row items-start justify-between gap-4">
          <div>
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Refine a lista por categoria.</SheetDescription>
          </div>
          <IconButton
            type="button"
            aria-label="Fechar filtros"
            variant="ghost"
            className="size-11"
            onClick={() => setOpen(false)}
          >
            <XIcon className="size-5" aria-hidden="true" />
          </IconButton>
        </SheetHeader>
        <form action="/" className="grid gap-4">
          {props.status ? (
            <input type="hidden" name="status" value={props.status} />
          ) : null}
          {props.search ? (
            <input type="hidden" name="q" value={props.search} />
          ) : null}
          <CategoryFilter {...props} mobile />
          <div className="grid gap-2">
            <Button type="submit" size="lg">
              Aplicar filtros
            </Button>
            {hasRefinement ? (
              <Link
                href={currentViewHref(props.status)}
                className={buttonVariants({ variant: "ghost", size: "lg" })}
                onClick={() => setOpen(false)}
              >
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
