"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  Button,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ExternalLinkIcon,
  EyeIcon,
  SaveIcon,
  StatusBadge,
  buttonVariants,
  cn,
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
    <header className="sticky top-14 z-30 flex h-14 items-center justify-between border-b border-border-subtle bg-surface/95 px-4 backdrop-blur md:top-0 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-ui-md font-semibold text-text-secondary transition-colors [transition-duration:var(--motion-duration-normal)] hover:text-text-primary"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Matérias</span>
        </Link>
        <span className="h-4 w-px bg-border-subtle" aria-hidden="true" />
        <h1 className="truncate text-ui-lg font-semibold tracking-tight text-text-primary">
          {isExisting ? "Editar matéria" : "Nova matéria"}
        </h1>
        <StatusBadge status={status.status} label={status.label} size="sm" />
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <Button
          type="submit"
          form="article-editor-form"
          name="intent"
          value="save"
          disabled={operationPending}
          variant="secondary"
          size="lg"
        >
          <SaveIcon aria-hidden="true" />
          <span>
            {pending
              ? "Salvando…"
              : isExisting
                ? "Salvar revisão"
                : "Salvar rascunho"}
          </span>
        </Button>

        {isExisting && articleId ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={operationPending}
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "group",
              )}
            >
              <EyeIcon aria-hidden="true" />
              <span>Visualizar</span>
              <ChevronDownIcon
                className="size-3 text-text-secondary"
                aria-hidden="true"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={6} className="w-64">
              <DropdownMenuItem
                disabled={operationPending}
                onClick={openLivePreview}
                className="items-start justify-between py-2.5"
              >
                <span>
                  <span className="block font-semibold">Preview no Portal</span>
                  <span className="mt-0.5 block text-ui-xs font-normal text-text-secondary">
                    Alterações atuais · expira em 10 min.
                  </span>
                </span>
                <ExternalLinkIcon
                  className="mt-0.5 size-3.5 text-text-secondary"
                  aria-hidden="true"
                />
              </DropdownMenuItem>
              <p className="mx-2 mt-1 border-t border-border-subtle pt-2 pb-1 text-ui-xs leading-5 text-text-secondary">
                O preview não salva uma nova revisão.
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button
              type="button"
              disabled
              aria-describedby="new-preview-help"
              variant="secondary"
              size="lg"
            >
              <EyeIcon aria-hidden="true" />
              <span>Visualizar</span>
            </Button>
            <span id="new-preview-help" className="sr-only">
              Salve o primeiro rascunho para habilitar a visualização.
            </span>
          </>
        )}

        {canPublish ? (
          <Button
            type="submit"
            form="article-editor-form"
            name="intent"
            value="publish"
            aria-label={publishLabel}
            disabled={operationPending || currentStatus === "archived"}
            size="lg"
          >
            {pending ? "Publicando…" : publishLabel}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
