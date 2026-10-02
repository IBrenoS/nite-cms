"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  EyeIcon,
  SaveIcon,
  StatusBadge,
  type StatusBadgeStatus,
} from "@nite/cms-ui";

type EditorHeaderProps = {
  isExisting: boolean;
  articleId?: string;
  status: { status: StatusBadgeStatus; label: string };
  pending: boolean;
  operationPending: boolean;
  canPublish: boolean;
  currentStatus?: "draft" | "published" | "archived";
  hasUnpublishedChanges?: boolean;
  openLivePreview: () => void;
};

export function EditorHeader({
  isExisting,
  articleId,
  status,
  pending,
  operationPending,
  canPublish,
  currentStatus,
  hasUnpublishedChanges,
  openLivePreview,
}: EditorHeaderProps) {
  const publishLabel =
    currentStatus === "published" || hasUnpublishedChanges
      ? "Publicar alterações"
      : "Publicar matéria";

  return (
    <header className="sticky top-14 z-30 flex h-14 items-center justify-between border-b border-nite-border-subtle bg-nite-surface/95 px-4 backdrop-blur md:top-0 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-semibold text-nite-text-secondary transition-colors hover:text-nite-text-primary"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Matérias</span>
        </Link>
        <span className="h-4 w-px bg-nite-border-subtle" aria-hidden="true" />
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-nite-text-primary">
          {isExisting ? "Editar matéria" : "Nova matéria"}
        </h1>
        <StatusBadge
          status={status.status}
          label={status.label}
          size="sm"
          variant="outline"
        />
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <button
          type="submit"
          form="article-editor-form"
          name="intent"
          value="save"
          disabled={operationPending}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-nite-border-subtle bg-nite-surface px-3.5 text-sm font-semibold text-nite-text-primary transition-colors hover:bg-nite-section disabled:cursor-not-allowed disabled:opacity-55"
        >
          <SaveIcon className="size-4" aria-hidden="true" />
          <span>
            {pending
              ? "Salvando…"
              : isExisting
                ? "Salvar revisão"
                : "Salvar rascunho"}
          </span>
        </button>

        {isExisting && articleId ? (
          <details className="group relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-nite-border-subtle bg-nite-surface px-3.5 text-sm font-semibold text-nite-text-primary transition-colors hover:bg-nite-section">
              <EyeIcon className="size-4" aria-hidden="true" />
              <span>Visualizar</span>
              <ChevronDownIcon
                className="size-3 text-nite-text-secondary transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="absolute top-full right-0 z-50 mt-1.5 w-64 rounded-lg border border-nite-border-subtle bg-nite-surface p-1.5 shadow-lg">
              <button
                type="button"
                aria-label="Preview no Portal"
                disabled={operationPending}
                onClick={openLivePreview}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-nite-text-primary hover:bg-nite-section disabled:opacity-55"
              >
                <span>
                  <span className="block font-semibold">Preview no Portal</span>
                  <span className="block text-xs text-nite-text-secondary">
                    Alterações atuais · expira em 10 min.
                  </span>
                </span>
                <ExternalLinkIcon
                  className="size-3 text-nite-text-secondary"
                  aria-hidden="true"
                />
              </button>
              <p className="mx-2 mt-1 border-t border-nite-border-subtle pt-2 text-xs leading-5 text-nite-text-secondary">
                O preview não salva uma nova revisão.
              </p>
            </div>
          </details>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-describedby="new-preview-help"
              className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-nite-border-subtle bg-nite-section px-3.5 text-sm font-semibold text-nite-text-secondary opacity-60"
            >
              <EyeIcon className="size-3.5" aria-hidden="true" />
              <span>Visualizar</span>
            </button>
            <span id="new-preview-help" className="sr-only">
              Salve o primeiro rascunho para habilitar a visualização.
            </span>
          </>
        )}

        {canPublish ? (
          <button
            type="submit"
            form="article-editor-form"
            name="intent"
            value="publish"
            aria-label={publishLabel}
            disabled={operationPending || currentStatus === "archived"}
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-nite-brand-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending ? "Publicando…" : publishLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}
