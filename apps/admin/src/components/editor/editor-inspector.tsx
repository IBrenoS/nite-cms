"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";
import {
  ArchiveIcon,
  Button,
  Checkbox,
  CheckCircleIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CircleIcon,
  EyeIcon,
  ImageUpIcon,
  IconButton,
  Input,
  RotateCcwIcon,
  Select,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  XIcon,
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

type PreparationItem = {
  label: string;
  complete: boolean;
  target?: EditorialField;
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
  completePreparationItems: PreparationItem[];
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
  onNavigateToField: (field: EditorialField) => void;
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
  onNavigateToField,
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

  const inspectorTabs = (
    <Tabs
      value={activeTab}
      onValueChange={(value) =>
        setActiveTab(value as "publishing" | "revisions")
      }
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="publishing">Publicação</TabsTrigger>
        <TabsTrigger value="revisions" disabled={revisions.length === 0}>
          Revisões{revisions.length > 0 ? ` (${revisions.length})` : ""}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );

  return (
    <aside
      className="flex h-full min-h-0 flex-col text-ui-md"
      aria-label="Configurações da matéria"
    >
      <div className="shrink-0 bg-surface pb-3">
        {mode !== "rail" && onClose ? (
          <div className="mb-3 flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h2 className="text-ui-md font-semibold text-text-primary">
                Configurações da matéria
              </h2>
              <p className="text-ui-sm text-text-secondary">
                Preparação {preparationCount}/6
              </p>
            </div>
            <IconButton
              type="button"
              variant="secondary"
              onClick={onClose}
              aria-label="Fechar painel"
            >
              <XIcon aria-hidden="true" />
            </IconButton>
          </div>
        ) : null}
        {inspectorTabs}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {activeTab === "revisions" ? (
          <section className="space-y-3 pb-5">
            <div className="border-b border-border-subtle pb-2">
              <h2 className="text-ui-md font-semibold text-text-primary">
                Histórico de revisões
              </h2>
              <p className="mt-0.5 text-ui-sm text-text-secondary">
                Cada salvamento gera um snapshot imutável da matéria.
              </p>
            </div>
            {revisions.length > 0 ? (
              <ol className="divide-y divide-border-subtle">
                {revisions.map((revision) => (
                  <li
                    key={revision.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-text-primary">
                          v{revision.version}
                        </span>
                        {revision.id === currentRevisionId ? (
                          <StatusBadge
                            status="progress"
                            label="Atual"
                            size="sm"
                          />
                        ) : null}
                        {revision.id === publishedRevisionId ? (
                          <StatusBadge
                            status="done"
                            label="Publicada"
                            size="sm"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-ui-sm text-text-secondary">
                        {revision.title || "Sem título"}
                      </p>
                      <p className="font-mono text-ui-xs text-text-muted">
                        {revisionDateFormatter.format(
                          new Date(revision.createdAt),
                        )}
                      </p>
                    </div>
                    {articleId ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onViewRevision(revision.id)}
                        disabled={operationPending}
                      >
                        <EyeIcon aria-hidden="true" />
                        Visualizar
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ui-sm text-text-secondary">
                Salve a primeira revisão para iniciar o histórico.
              </p>
            )}
          </section>
        ) : (
          <div className="divide-y divide-border-subtle">
            <section className="space-y-4 pb-5">
              <div
                className={`rounded-lg border p-3 ${
                  fieldErrorEntries.length > 0
                    ? "border-danger-border bg-danger-bg"
                    : readyForFinalReview
                      ? "border-success-border bg-success-bg"
                      : "border-warning-border bg-warning-bg"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm ${
                      fieldErrorEntries.length > 0
                        ? "text-danger"
                        : readyForFinalReview
                          ? "text-success"
                          : "text-warning"
                    }`}
                  >
                    {readyForFinalReview && fieldErrorEntries.length === 0 ? (
                      <CheckCircleIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <CircleAlertIcon className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-text-primary">
                      {fieldErrorEntries.length > 0
                        ? "Há pendências para publicar"
                        : readyForFinalReview
                          ? "Pronta para revisão final"
                          : "Antes de publicar"}
                    </h2>
                    <p className="mt-0.5 text-ui-sm text-text-secondary">
                      {fieldErrorEntries.length > 0
                        ? "Abra uma pendência abaixo para ir diretamente ao campo que precisa de atenção."
                        : readyForFinalReview
                          ? "Os requisitos obrigatórios foram preenchidos."
                          : "A preparação acompanha o que ainda falta para a matéria ficar pronta."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-text-primary">
                    Preparação
                  </h2>
                  <span className="font-mono font-semibold text-text-secondary">
                    {preparationCount} de 6
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-surface-subtle">
                  <div
                    className="h-full bg-primary transition-all [transition-duration:var(--motion-duration-normal)]"
                    style={{ width: `${(preparationCount / 6) * 100}%` }}
                  />
                </div>
                <ul className="space-y-1">
                  {completePreparationItems.map((item) => (
                    <li key={item.label}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!item.target}
                        onClick={() =>
                          item.target && onNavigateToField(item.target)
                        }
                        className={`h-auto w-full justify-start gap-2 px-1.5 py-1 text-left ${
                          item.complete ? "text-success" : "text-text-secondary"
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
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="space-y-4 py-5">
              <div>
                <h2 className="font-semibold text-text-primary">Essencial</h2>
                <p className="mt-0.5 text-ui-sm text-text-secondary">
                  Campos obrigatórios para concluir a publicação.
                </p>
              </div>

              <div>
                <label
                  className="mb-1 block font-semibold text-text-primary"
                  htmlFor="category"
                >
                  Categoria
                </label>
                <Select
                  id="category"
                  name="category"
                  value={category}
                  data-editorial-field="category"
                  aria-invalid={Boolean(fieldErrors.category)}
                  aria-describedby={
                    fieldErrors.category ? "category-error" : undefined
                  }
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
                </Select>
                {fieldErrors.category ? (
                  <p
                    id="category-error"
                    className="mt-1 text-ui-sm text-danger"
                  >
                    {fieldErrors.category[0]}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  className="mb-1 block font-semibold text-text-primary"
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
                  onChange={(event) => onBylineChange(event.target.value)}
                />
                <p className="mt-1 text-ui-sm text-text-secondary">
                  Pessoa, equipe ou redação responsável pela matéria.
                </p>
                {fieldErrors.byline ? (
                  <p id="byline-error" className="mt-1 text-ui-sm text-danger">
                    {fieldErrors.byline[0]}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-border-subtle pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary">
                    Capa da matéria
                  </h3>
                  <span className="text-ui-sm font-medium text-danger">
                    Obrigatória
                  </span>
                </div>
                <p className="text-ui-sm text-text-secondary">
                  Aparece nos cards e como imagem principal no topo da matéria.
                </p>
                <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-dashed border-border-strong bg-surface-subtle">
                  {coverPreviewUrl ? (
                    <Image
                      src={coverPreviewUrl}
                      alt={coverAlt || "Prévia da capa selecionada"}
                      fill
                      unoptimized
                      sizes="336px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                      <ImageUpIcon
                        className="size-5 text-primary"
                        aria-hidden="true"
                      />
                      <span className="mt-1.5 font-semibold text-text-primary">
                        Selecionar imagem
                      </span>
                      <span className="text-ui-sm text-text-secondary">
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
                    <Input
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
                        mediaState === "uploading" ||
                        mediaState === "processing"
                      }
                      className="sr-only"
                      onChange={handleCoverChange}
                    />
                  </label>
                  {coverPreviewUrl ? (
                    <span className="absolute right-1.5 bottom-1.5 rounded-sm bg-text-primary/80 px-1.5 py-0.5 text-ui-sm font-semibold text-text-inverse">
                      Substituir
                    </span>
                  ) : null}
                </div>
                {fieldErrors.coverMedia ? (
                  <p id="cover-media-error" className="text-ui-sm text-danger">
                    {fieldErrors.coverMedia[0]}
                  </p>
                ) : null}
                {mediaState !== "idle" ? (
                  <p
                    role={mediaState === "error" ? "alert" : "status"}
                    className={`text-ui-sm ${mediaState === "error" ? "text-danger" : "text-text-secondary"}`}
                  >
                    {mediaMessage ??
                      (mediaState === "uploading"
                        ? "Enviando arquivo…"
                        : mediaState === "processing"
                          ? "Preparando capa…"
                          : "Capa pronta.")}
                  </p>
                ) : null}

                <div>
                  <label
                    className="mb-1 block font-semibold text-text-primary"
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
                    className="min-h-16 resize-none"
                    onChange={(event) => onCoverAltChange(event.target.value)}
                  />
                  {fieldErrors.coverAlt ? (
                    <p
                      id="cover-alt-error"
                      className="mt-1 text-ui-sm text-danger"
                    >
                      {fieldErrors.coverAlt[0]}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="py-5">
              <details
                className="group"
                open={Boolean(
                  coverCaption ||
                  coverCredit ||
                  fieldErrors.coverCaption ||
                  fieldErrors.coverCredit,
                )}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-text-primary">
                  <span>Apresentação</span>
                  <ChevronDownIcon
                    className="size-4 text-text-secondary transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-1 text-ui-sm text-text-secondary">
                  Informações opcionais exibidas junto à capa.
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label
                      className="mb-1 block font-semibold text-text-primary"
                      htmlFor="coverCaption"
                    >
                      Legenda{" "}
                      <span className="font-normal text-text-secondary">
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
                      onChange={(event) =>
                        onCoverCaptionChange(event.target.value)
                      }
                      placeholder="Contexto visível abaixo da capa"
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block font-semibold text-text-primary"
                      htmlFor="coverCredit"
                    >
                      Crédito{" "}
                      <span className="font-normal text-text-secondary">
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
                      onChange={(event) =>
                        onCoverCreditChange(event.target.value)
                      }
                      placeholder="Foto: nome ou instituição"
                    />
                  </div>
                </div>
              </details>
            </section>

            <section className="py-5">
              <details
                className="group"
                open={Boolean(eventDate || featured || fieldErrors.eventDate)}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-text-primary">
                  <span>Distribuição</span>
                  <ChevronDownIcon
                    className="size-4 text-text-secondary transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-1 text-ui-sm text-text-secondary">
                  Opções que alteram a forma como a matéria aparece no Portal.
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label
                      className="mb-1 block font-semibold text-text-primary"
                      htmlFor="eventDate"
                    >
                      Data do evento{" "}
                      <span className="font-normal text-text-secondary">
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
                    />
                    {fieldErrors.eventDate ? (
                      <p
                        id="event-date-error"
                        className="mt-1 text-ui-sm text-danger"
                      >
                        {fieldErrors.eventDate[0]}
                      </p>
                    ) : null}
                  </div>
                  <label className="flex items-start gap-2 text-ui-sm">
                    <Checkbox
                      name="featured"
                      value="on"
                      defaultChecked={featured}
                      className="mt-0.5"
                      aria-label="Destacar no Nite News"
                    />
                    <span>
                      <span className="block font-semibold text-text-primary">
                        Destacar no Nite News
                      </span>
                      <span className="block text-text-secondary">
                        Dá maior evidência à matéria no Portal.
                      </span>
                    </span>
                  </label>
                </div>
              </details>
            </section>

            <section className="py-5">
              <details
                className="group"
                open={
                  seoPanelOpen ||
                  slugPanelOpen ||
                  Boolean(
                    fieldErrors.slug ||
                    fieldErrors.seoTitle ||
                    fieldErrors.seoDescription,
                  )
                }
                onToggle={(event) => {
                  onSeoToggle(event.currentTarget.open);
                  onSlugToggle(event.currentTarget.open);
                }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-text-primary">
                  <span>Busca e URL</span>
                  <ChevronDownIcon
                    className="size-4 text-text-secondary transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-1 text-ui-sm text-text-secondary">
                  Configurações avançadas para busca e endereço público.
                </p>
                <div className="mt-3 space-y-4">
                  <div>
                    <label
                      className="mb-1 block font-semibold text-text-primary"
                      htmlFor="slug"
                    >
                      URL da matéria
                    </label>
                    <Input
                      id="slug"
                      name="slug"
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      data-editorial-field="slug"
                      value={slug}
                      readOnly={slugLocked}
                      aria-invalid={Boolean(fieldErrors.slug)}
                      aria-describedby={
                        fieldErrors.slug ? "slug-error" : "slug-help"
                      }
                      className="font-mono"
                      onChange={(event) => onSlugChange(event.target.value)}
                    />
                    {fieldErrors.slug ? (
                      <p
                        id="slug-error"
                        className="mt-1 text-ui-sm text-danger"
                      >
                        {fieldErrors.slug[0]}
                      </p>
                    ) : (
                      <p
                        id="slug-help"
                        className="mt-1 text-ui-sm text-text-secondary"
                      >
                        {slugLocked
                          ? "Bloqueada desde a primeira publicação."
                          : "Gerada pelo título e bloqueada na primeira publicação."}
                      </p>
                    )}
                  </div>

                  <div className="rounded-md border border-border-subtle bg-surface-subtle p-3">
                    <p className="truncate font-semibold text-primary">
                      {seoTitle.trim() || title.trim() || "Título da matéria"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-ui-sm text-text-secondary">
                      {seoDescription.trim() ||
                        summary.trim() ||
                        "O resumo da matéria aparecerá aqui."}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-text-primary">
                      Título para busca
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
                      onChange={(event) => onSeoTitleChange(event.target.value)}
                    />
                    {fieldErrors.seoTitle ? (
                      <p
                        id="seo-title-error"
                        className="mt-1 text-ui-sm text-danger"
                      >
                        {fieldErrors.seoTitle[0]}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-text-primary">
                      Descrição para busca
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
                      className="min-h-20 resize-none"
                      onChange={(event) =>
                        onSeoDescriptionChange(event.target.value)
                      }
                    />
                    {fieldErrors.seoDescription ? (
                      <p
                        id="seo-description-error"
                        className="mt-1 text-ui-sm text-danger"
                      >
                        {fieldErrors.seoDescription[0]}
                      </p>
                    ) : null}
                  </div>
                </div>
              </details>
            </section>

            {isExisting ? (
              <section className="py-5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-text-primary">
                    <span>Estado editorial</span>
                    <ChevronDownIcon
                      className="size-4 text-text-secondary transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="mt-3 grid gap-1.5">
                    {currentStatus === "published" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={lifecyclePending}
                        disabled={operationPending}
                        onClick={() => onTransitionLifecycle("unpublish")}
                        className="justify-start"
                      >
                        <RotateCcwIcon
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        Despublicar
                      </Button>
                    ) : null}

                    {currentStatus !== "archived" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={lifecyclePending}
                        disabled={operationPending}
                        onClick={() => onTransitionLifecycle("archive")}
                        className="justify-start"
                      >
                        <ArchiveIcon className="size-3.5" aria-hidden="true" />
                        Arquivar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={lifecyclePending}
                        disabled={operationPending}
                        onClick={() => onTransitionLifecycle("restore")}
                        className="justify-start"
                      >
                        <RotateCcwIcon
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        Restaurar
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
                </details>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
