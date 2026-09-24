"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";
import {
  ArchiveIcon,
  Button,
  CheckCircleIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CircleIcon,
  EyeIcon,
  ImageUpIcon,
  Input,
  RotateCcwIcon,
  StatusBadge,
  Textarea,
} from "@nite/cms-ui";
import { newsCategoryValues, type EditorialDraftInput } from "@nite/editorial";
import type {
  EditorialField,
  EditorialFieldErrors,
} from "@/lib/editorial-form";
import { ArticleDeletionDialog } from "../article-deletion-dialog";

type RevisionItem = {
  id: string;
  version: number;
  title: string | null;
  createdAt: Date;
};

export type EditorInspectorProps = {
  title: string;
  summary: string;
  isExisting: boolean;
  articleId?: string;
  currentRevisionId: string;
  publishedRevisionId: string | null;
  currentStatus?: "draft" | "published" | "archived";
  revisions?: RevisionItem[];
  fieldErrors: EditorialFieldErrors;
  preparationCount: number;
  readyForFinalReview: boolean;
  completePreparationItems: Array<{ label: string; complete: boolean }>;
  category: string;
  byline: string;
  eventDate?: string;
  featured?: boolean;
  slug: string;
  slugLocked: boolean;
  slugPanelOpen: boolean;
  coverPreviewUrl?: string;
  coverAlt: string;
  coverCaption: string;
  coverCredit: string;
  mediaState: "idle" | "uploading" | "processing" | "ready" | "error";
  mediaMessage?: string;
  seoTitle: string;
  seoDescription: string;
  seoPanelOpen: boolean;
  operationPending: boolean;
  canDelete: boolean;
  isDirty: boolean;
  lifecyclePending: boolean;
  mode?: "rail" | "drawer" | "sheet";
  onClose?: () => void;
  onCategoryChange: (value: EditorialDraftInput["category"]) => void;
  onBylineChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onSlugToggle: (open: boolean) => void;
  onCoverFileSelect: (file: File) => void;
  onCoverAltChange: (value: string) => void;
  onCoverCaptionChange: (value: string) => void;
  onCoverCreditChange: (value: string) => void;
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  onSeoToggle: (open: boolean) => void;
  onTransitionLifecycle: (intent: "unpublish" | "archive" | "restore") => void;
  onViewRevision: (revisionId: string) => void;
  onDeletionPendingChange: (pending: boolean) => void;
  onDeleted: (scheduledMediaCount: number) => void;
};

const categoryLabels = {
  agenda: "Agenda",
  comunidade: "Comunidade",
  projetos: "Projetos",
  inovacao: "Inovação",
  cultura: "Cultura",
  tecnologia: "Tecnologia",
} satisfies Record<(typeof newsCategoryValues)[number], string>;

const editorialFieldTarget: Record<EditorialField, string> = {
  slug: "slug",
  title: "title",
  summary: "summary",
  category: "category",
  body: "body-error",
  byline: "byline",
  eventDate: "eventDate",
  coverMedia: "cover-media-error",
  coverAlt: "coverAlt",
  coverCaption: "coverCaption",
  coverCredit: "coverCredit",
  seoTitle: "seo-title-error",
  seoDescription: "seo-description-error",
};

const revisionDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function EditorInspector({
  title,
  summary,
  isExisting,
  articleId,
  currentRevisionId,
  publishedRevisionId,
  currentStatus,
  revisions = [],
  fieldErrors,
  preparationCount,
  readyForFinalReview,
  completePreparationItems,
  category,
  byline,
  eventDate,
  featured,
  slug,
  slugLocked,
  slugPanelOpen,
  coverPreviewUrl,
  coverAlt,
  coverCaption,
  coverCredit,
  mediaState,
  mediaMessage,
  seoTitle,
  seoDescription,
  seoPanelOpen,
  operationPending,
  canDelete,
  isDirty,
  lifecyclePending,
  mode = "rail",
  onClose,
  onCategoryChange,
  onBylineChange,
  onSlugChange,
  onSlugToggle,
  onCoverFileSelect,
  onCoverAltChange,
  onCoverCaptionChange,
  onCoverCreditChange,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onSeoToggle,
  onTransitionLifecycle,
  onViewRevision,
  onDeletionPendingChange,
  onDeleted,
}: EditorInspectorProps) {
  const [activeTab, setActiveTab] = useState<"publishing" | "revisions">(
    "publishing",
  );
  const fieldErrorEntries = Object.entries(fieldErrors) as Array<
    [EditorialField, string[]]
  >;

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onCoverFileSelect(file);
  }

  return (
    <aside className="space-y-4 text-xs" aria-label="Configurações da matéria">
      {/* Header for drawer/sheet mode */}
      {mode !== "rail" && onClose ? (
        <div className="flex items-center justify-between border-b border-nite-border-subtle pb-3">
          <div>
            <h2 className="text-sm font-semibold text-nite-text-primary">
              Configurações da matéria
            </h2>
            <p className="text-xs text-nite-text-secondary">
              Preparação {preparationCount}/6
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="flex size-10 items-center justify-center rounded-md border border-nite-border-subtle text-nite-text-secondary hover:bg-nite-section hover:text-nite-text-primary"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Inspector Tabs (when revisions available) */}
      {revisions.length > 0 ? (
        <div className="flex rounded-md border border-nite-border-subtle bg-nite-section/50 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("publishing")}
            className={`flex-1 rounded py-1.5 text-xs font-medium transition-colors ${
              activeTab === "publishing"
                ? "bg-nite-surface text-nite-text-primary font-semibold shadow-xs"
                : "text-nite-text-secondary hover:text-nite-text-primary"
            }`}
          >
            Publicação
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("revisions")}
            className={`flex-1 rounded py-1.5 text-xs font-medium transition-colors ${
              activeTab === "revisions"
                ? "bg-nite-surface text-nite-text-primary font-semibold shadow-xs"
                : "text-nite-text-secondary hover:text-nite-text-primary"
            }`}
          >
            Revisões ({revisions.length})
          </button>
        </div>
      ) : null}

      {activeTab === "revisions" && revisions.length > 0 ? (
        <section className="space-y-3">
          <div className="border-b border-nite-border-subtle pb-2">
            <h2 className="text-xs font-semibold text-nite-text-primary">
              Histórico de revisões
            </h2>
            <p className="mt-0.5 text-xs text-nite-text-secondary">
              Cada salvamento gera um snapshot imutável.
            </p>
          </div>
          <ol className="divide-y divide-nite-border-subtle max-h-[500px] overflow-y-auto">
            {revisions.map((rev) => (
              <li
                key={rev.id}
                className="flex items-center justify-between gap-2 py-3 transition-colors hover:bg-nite-section/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-nite-text-primary">
                      v{rev.version}
                    </span>
                    {rev.id === currentRevisionId ? (
                      <StatusBadge status="progress" label="Atual" size="sm" />
                    ) : null}
                    {rev.id === publishedRevisionId ? (
                      <StatusBadge status="done" label="Publicada" size="sm" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-nite-text-secondary">
                    {rev.title || "Sem título"}
                  </p>
                  <p className="font-mono text-xs text-nite-text-muted">
                    {revisionDateFormatter.format(new Date(rev.createdAt))}
                  </p>
                </div>
                {articleId ? (
                  <button
                    type="button"
                    onClick={() => onViewRevision(rev.id)}
                    disabled={operationPending}
                    className="inline-flex items-center gap-1 rounded border border-nite-border-subtle px-2.5 py-1 text-xs font-medium text-nite-brand-primary hover:bg-nite-section shrink-0"
                  >
                    <EyeIcon className="size-3" aria-hidden="true" />
                    <span>Visualizar versão</span>
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : (
        /* Superfície Contínua: Seções separadas por divisores */
        <div className="divide-y divide-nite-border-subtle">
          {/* 1. Preparação e pendências */}
          <div className="space-y-3 pb-4">
            {/* Validation Banner if errors exist */}
            <div
              className={`rounded-lg border p-3 ${
                fieldErrorEntries.length > 0
                  ? "border-status-error/40 bg-status-error/5"
                  : "border-nite-border-subtle bg-nite-section/30"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded ${
                    fieldErrorEntries.length > 0
                      ? "bg-status-error/10 text-status-error"
                      : readyForFinalReview
                        ? "bg-status-done/10 text-status-done"
                        : "bg-status-warning/10 text-status-warning"
                  }`}
                >
                  {readyForFinalReview && fieldErrorEntries.length === 0 ? (
                    <CheckCircleIcon className="size-3.5" aria-hidden="true" />
                  ) : (
                    <CircleAlertIcon className="size-3.5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold">
                    {fieldErrorEntries.length > 0
                      ? "Revise os campos destacados."
                      : readyForFinalReview
                        ? "Pronta para revisão final"
                        : "Antes de publicar"}
                  </h2>
                  {fieldErrorEntries.length > 0 ? (
                    <ul className="mt-1.5 grid gap-1 text-xs text-status-error">
                      {fieldErrorEntries.map(([field, messages]) => (
                        <li key={field}>
                          <a
                            href={`#${editorialFieldTarget[field]}`}
                            className="underline outline-none hover:text-red-700"
                          >
                            {messages[0]}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-0.5 text-xs text-nite-text-secondary">
                      {readyForFinalReview
                        ? "Os requisitos editoriais foram preenchidos."
                        : "As pendências são acompanhadas na preparação e levam você ao campo que precisa de atenção."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Preparation Progress & Checklist */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-nite-text-primary">
                  Preparação
                </h2>
                <span className="font-mono text-xs font-semibold text-nite-text-secondary">
                  {preparationCount} de 6
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-nite-section">
                <div
                  className="h-full bg-nite-brand-primary transition-all duration-200"
                  style={{ width: `${(preparationCount / 6) * 100}%` }}
                />
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {completePreparationItems.map((item) => (
                  <li
                    key={item.label}
                    className={`flex items-center gap-1.5 ${
                      item.complete
                        ? "text-status-done"
                        : "text-nite-text-secondary"
                    }`}
                  >
                    {item.complete ? (
                      <CheckCircleIcon
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <CircleIcon
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 2. Publicação essencial */}
          <div className="space-y-3 py-4">
            <h2 className="text-xs font-semibold text-nite-text-primary">
              Publicação essencial
            </h2>

            <div>
              <label
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
                htmlFor="category"
              >
                Categoria
              </label>
              <select
                id="category"
                name="category"
                value={category}
                data-editorial-field="category"
                aria-invalid={Boolean(fieldErrors.category)}
                aria-describedby={
                  fieldErrors.category ? "category-error" : undefined
                }
                className="nite-form-field min-h-10 w-full rounded-md border border-nite-border-subtle bg-nite-surface px-2.5 py-1 text-xs outline-none focus:border-nite-brand-primary"
                onChange={(event) =>
                  onCategoryChange(
                    event.target.value as EditorialDraftInput["category"],
                  )
                }
              >
                <option value="">Selecione</option>
                {newsCategoryValues.map((value) => (
                  <option key={value} value={value}>
                    {categoryLabels[value]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs leading-4 text-nite-text-secondary">
                Organiza a matéria nas listagens e filtros do Portal.
              </p>
              {fieldErrors.category ? (
                <p
                  id="category-error"
                  className="mt-1 text-xs text-status-error"
                >
                  {fieldErrors.category[0]}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
                htmlFor="byline"
              >
                Assinatura
              </label>
              <Input
                id="byline"
                name="byline"
                value={byline}
                data-editorial-field="byline"
                aria-invalid={Boolean(fieldErrors.byline)}
                aria-describedby={
                  fieldErrors.byline ? "byline-error" : undefined
                }
                className="min-h-10 rounded-md text-xs"
                onChange={(event) => onBylineChange(event.target.value)}
              />
              <p className="mt-1 text-xs leading-4 text-nite-text-secondary">
                Nome da pessoa, equipe ou redação responsável pela matéria.
              </p>
              {fieldErrors.byline ? (
                <p id="byline-error" className="mt-1 text-xs text-status-error">
                  {fieldErrors.byline[0]}
                </p>
              ) : null}
            </div>
          </div>

          {/* 3. Capa da matéria */}
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-nite-text-primary">
                Capa da matéria
              </h2>
              <span className="text-xs font-medium text-status-error">
                Obrigatória
              </span>
            </div>
            <p className="text-xs leading-4 text-nite-text-secondary">
              Aparece nos cards e como imagem principal no topo da matéria.
            </p>

            <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-dashed border-nite-border-strong bg-nite-section">
              {coverPreviewUrl ? (
                <Image
                  src={coverPreviewUrl}
                  alt={coverAlt || "Prévia da capa selecionada"}
                  fill
                  unoptimized
                  sizes="312px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                  <ImageUpIcon
                    className="size-5 text-nite-brand-primary"
                    aria-hidden="true"
                  />
                  <span className="mt-1.5 text-xs font-semibold text-nite-text-primary">
                    Selecionar imagem
                  </span>
                  <span className="text-xs text-nite-text-secondary">
                    JPEG, PNG ou WebP · até 10 MB
                  </span>
                </div>
              )}
              <label
                htmlFor="cover-file"
                className="absolute inset-0 cursor-pointer rounded-md outline-none focus-within:ring-2 focus-within:ring-ring"
              >
                <span className="sr-only">
                  {coverPreviewUrl
                    ? "Substituir imagem de capa"
                    : "Selecionar imagem de capa"}
                </span>
                <input
                  id="cover-file"
                  aria-label="Arquivo de capa"
                  type="file"
                  data-editorial-field="coverMedia"
                  aria-invalid={Boolean(fieldErrors.coverMedia)}
                  aria-describedby={
                    fieldErrors.coverMedia ? "cover-media-error" : undefined
                  }
                  accept="image/jpeg,image/png,image/webp"
                  disabled={
                    mediaState === "uploading" || mediaState === "processing"
                  }
                  className="sr-only"
                  onChange={handleCoverChange}
                />
              </label>
              {coverPreviewUrl ? (
                <span className="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
                  Substituir
                </span>
              ) : null}
            </div>

            {fieldErrors.coverMedia ? (
              <p id="cover-media-error" className="text-xs text-status-error">
                {fieldErrors.coverMedia[0]}
              </p>
            ) : null}

            <div>
              <label
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
                htmlFor="coverAlt"
              >
                Texto alternativo
              </label>
              <Textarea
                id="coverAlt"
                name="coverAlt"
                rows={2}
                value={coverAlt}
                data-editorial-field="coverAlt"
                aria-invalid={Boolean(fieldErrors.coverAlt)}
                aria-describedby={
                  fieldErrors.coverAlt ? "cover-alt-error" : undefined
                }
                placeholder="Descreva a imagem para acessibilidade."
                className="min-h-14 resize-none rounded-md text-xs"
                onChange={(event) => onCoverAltChange(event.target.value)}
              />
              <p className="mt-1 text-xs leading-4 text-nite-text-secondary">
                Descreva o que é relevante na imagem para leitores de tela.
              </p>
              {fieldErrors.coverAlt ? (
                <p
                  id="cover-alt-error"
                  className="mt-1 text-xs text-status-error"
                >
                  {fieldErrors.coverAlt[0]}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
                htmlFor="coverCaption"
              >
                Legenda{" "}
                <span className="font-normal text-nite-text-secondary">
                  (opcional)
                </span>
              </label>
              <Input
                id="coverCaption"
                name="coverCaption"
                maxLength={280}
                value={coverCaption}
                data-editorial-field="coverCaption"
                aria-invalid={Boolean(fieldErrors.coverCaption)}
                onChange={(event) => onCoverCaptionChange(event.target.value)}
                placeholder="Contexto visível abaixo da capa"
                className="min-h-10 rounded-md text-xs"
              />
              {fieldErrors.coverCaption ? (
                <p className="mt-1 text-xs text-status-error">
                  {fieldErrors.coverCaption[0]}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-semibold text-nite-text-primary"
                htmlFor="coverCredit"
              >
                Crédito{" "}
                <span className="font-normal text-nite-text-secondary">
                  (opcional)
                </span>
              </label>
              <Input
                id="coverCredit"
                name="coverCredit"
                maxLength={160}
                value={coverCredit}
                data-editorial-field="coverCredit"
                aria-invalid={Boolean(fieldErrors.coverCredit)}
                onChange={(event) => onCoverCreditChange(event.target.value)}
                placeholder="Foto: nome ou instituição"
                className="min-h-10 rounded-md text-xs"
              />
              {fieldErrors.coverCredit ? (
                <p className="mt-1 text-xs text-status-error">
                  {fieldErrors.coverCredit[0]}
                </p>
              ) : null}
            </div>

            {mediaState !== "idle" ? (
              <p
                role={mediaState === "error" ? "alert" : "status"}
                className={`text-xs ${mediaState === "error" ? "text-status-error" : "text-nite-text-secondary"}`}
              >
                {mediaMessage ??
                  (mediaState === "uploading"
                    ? "Enviando arquivo…"
                    : mediaState === "processing"
                      ? "Validando e convertendo…"
                      : "Capa pronta.")}
              </p>
            ) : null}
          </div>

          {/* 4. Opções complementares (Disclosure) */}
          <div className="py-4">
            <details
              className="group"
              open={Boolean(
                eventDate ||
                featured ||
                fieldErrors.eventDate ||
                fieldErrors.slug ||
                slugPanelOpen,
              )}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-nite-text-primary">
                <span>Opções complementares</span>
                <ChevronDownIcon
                  className="size-3.5 text-nite-text-secondary transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold text-nite-text-primary"
                    htmlFor="eventDate"
                  >
                    Data do evento{" "}
                    <span className="font-normal text-nite-text-secondary">
                      (opcional)
                    </span>
                  </label>
                  <Input
                    id="eventDate"
                    name="eventDate"
                    type="date"
                    data-editorial-field="eventDate"
                    aria-invalid={Boolean(fieldErrors.eventDate)}
                    aria-describedby={
                      fieldErrors.eventDate ? "event-date-error" : undefined
                    }
                    defaultValue={eventDate}
                    className="min-h-10 rounded-md text-xs"
                  />
                  <p className="mt-1 text-xs leading-4 text-nite-text-secondary">
                    Mostrada quando a matéria se refere a um evento específico.
                  </p>
                  {fieldErrors.eventDate ? (
                    <p
                      id="event-date-error"
                      className="mt-1 text-xs text-status-error"
                    >
                      {fieldErrors.eventDate[0]}
                    </p>
                  ) : null}
                </div>

                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="featured"
                    defaultChecked={featured}
                    className="mt-0.5 size-3.5 accent-[var(--nite-brand-primary)]"
                  />
                  <span>
                    <span className="block font-semibold text-nite-text-primary">
                      Destacar no Nite News
                    </span>
                    <span className="block text-xs text-nite-text-secondary">
                      Dá maior evidência à matéria no portal.
                    </span>
                  </span>
                </label>

                {/* Slug sub-accordion */}
                <details
                  className="group border-t border-nite-border-subtle pt-2.5"
                  open={slugPanelOpen || Boolean(fieldErrors.slug)}
                  onToggle={(event) => onSlugToggle(event.currentTarget.open)}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-nite-text-secondary hover:text-nite-text-primary">
                    <span>Configuração avançada do slug</span>
                    <ChevronDownIcon
                      className="size-3.5 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <label className="mt-2 block" htmlFor="slug">
                    <span className="sr-only">Slug</span>
                    <Input
                      id="slug"
                      name="slug"
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      data-editorial-field="slug"
                      value={slug}
                      readOnly={slugLocked}
                      aria-invalid={Boolean(fieldErrors.slug)}
                      aria-describedby={
                        fieldErrors.slug
                          ? "slug-error"
                          : slugLocked
                            ? "slug-lock-help"
                            : "slug-help"
                      }
                      className="min-h-10 rounded-md font-mono text-xs"
                      onChange={(event) => onSlugChange(event.target.value)}
                    />
                  </label>
                  {fieldErrors.slug ? (
                    <p
                      id="slug-error"
                      className="mt-1 text-xs text-status-error"
                    >
                      {fieldErrors.slug[0]}
                    </p>
                  ) : slugLocked ? (
                    <p
                      id="slug-lock-help"
                      className="mt-1 text-xs leading-4 text-nite-text-secondary"
                    >
                      O slug foi bloqueado permanentemente na primeira
                      publicação.
                    </p>
                  ) : (
                    <p
                      id="slug-help"
                      className="mt-1 text-xs leading-4 text-nite-text-secondary"
                    >
                      Gerado pelo título e bloqueado na primeira publicação.
                    </p>
                  )}
                </details>
              </div>
            </details>
          </div>

          {/* 5. Aparência na busca (SEO) */}
          <div className="py-4">
            <details
              className="group"
              open={
                seoPanelOpen ||
                Boolean(fieldErrors.seoTitle || fieldErrors.seoDescription)
              }
              onToggle={(event) => onSeoToggle(event.currentTarget.open)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-nite-text-primary">
                <span>Aparência na busca (opcional)</span>
                <ChevronDownIcon
                  className="size-3.5 text-nite-text-secondary transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-1.5 text-xs text-nite-text-secondary">
                Se os campos ficarem vazios, o título e o resumo da matéria
                serão usados automaticamente.
              </p>
              <div className="mt-2.5 space-y-2.5">
                <div
                  aria-label="Prévia na busca"
                  className="rounded-md border border-nite-border-subtle bg-nite-section/40 p-2.5"
                >
                  <p className="truncate text-sm font-semibold text-nite-brand-primary">
                    {seoTitle.trim() || title.trim() || "Título da matéria"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-nite-text-secondary">
                    {seoDescription.trim() ||
                      summary.trim() ||
                      "O resumo da matéria aparecerá aqui."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-nite-text-primary">
                    Título SEO
                  </label>
                  <Input
                    aria-label="Título SEO"
                    name="seoTitle"
                    maxLength={60}
                    value={seoTitle}
                    data-editorial-field="seoTitle"
                    aria-invalid={Boolean(fieldErrors.seoTitle)}
                    aria-describedby={
                      fieldErrors.seoTitle ? "seo-title-error" : undefined
                    }
                    className="min-h-10 rounded-md text-xs"
                    onChange={(event) => onSeoTitleChange(event.target.value)}
                  />
                  <div className="mt-0.5 flex justify-between text-xs text-nite-text-secondary">
                    {fieldErrors.seoTitle ? (
                      <span id="seo-title-error" className="text-status-error">
                        {fieldErrors.seoTitle[0]}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="font-mono">{seoTitle.length}/60</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-nite-text-primary">
                    Descrição SEO
                  </label>
                  <Textarea
                    aria-label="Descrição SEO"
                    name="seoDescription"
                    maxLength={160}
                    value={seoDescription}
                    data-editorial-field="seoDescription"
                    aria-invalid={Boolean(fieldErrors.seoDescription)}
                    aria-describedby={
                      fieldErrors.seoDescription
                        ? "seo-description-error"
                        : undefined
                    }
                    className="min-h-16 resize-none rounded-md text-xs"
                    onChange={(event) =>
                      onSeoDescriptionChange(event.target.value)
                    }
                  />
                  <div className="mt-0.5 flex justify-between text-xs text-nite-text-secondary">
                    {fieldErrors.seoDescription ? (
                      <span
                        id="seo-description-error"
                        className="text-status-error"
                      >
                        {fieldErrors.seoDescription[0]}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="font-mono">
                      {seoDescription.length}/160
                    </span>
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* 6. Estado editorial */}
          {isExisting ? (
            <div className="py-4 space-y-2">
              <h2 className="text-xs font-semibold text-nite-text-primary">
                Estado editorial
              </h2>
              <div className="grid gap-1.5 pt-1">
                {currentStatus === "published" ? (
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    loading={lifecyclePending}
                    disabled={operationPending}
                    onClick={() => onTransitionLifecycle("unpublish")}
                    className="justify-start text-xs"
                  >
                    <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                    <span>Despublicar</span>
                  </Button>
                ) : null}

                {currentStatus !== "archived" ? (
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    loading={lifecyclePending}
                    disabled={operationPending}
                    onClick={() => onTransitionLifecycle("archive")}
                    className="justify-start text-xs"
                  >
                    <ArchiveIcon className="size-3.5" aria-hidden="true" />
                    <span>Arquivar</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={lifecyclePending}
                    disabled={operationPending}
                    onClick={() => onTransitionLifecycle("restore")}
                    className="justify-start text-xs"
                  >
                    <RotateCcwIcon className="size-3.5" aria-hidden="true" />
                    <span>Restaurar</span>
                  </Button>
                )}
                {canDelete && articleId ? (
                  <ArticleDeletionDialog
                    articleId={articleId}
                    expectedRevisionId={currentRevisionId}
                    isDirty={isDirty}
                    disabled={operationPending}
                    onPendingChange={onDeletionPendingChange}
                    onDeleted={onDeleted}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
