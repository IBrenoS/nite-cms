"use client";

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { Button, Input, StatusBadge, Textarea } from "@nite/cms-ui";

import {
  deriveEditorialSlug,
  newsCategoryValues,
  type EditorialDraftInput,
} from "@nite/editorial";
import {
  createMediaUploadAction,
  createPrivatePreviewLink,
  processMediaUploadAction,
  submitEditorialArticle,
  transitionEditorialArticle,
  type EditorialActionState,
} from "@/app/(workspace)/articles/actions";
import { createEditorialTiptapExtensions } from "@/lib/editorial-tiptap";
import {
  parseEditorialFormData,
  type EditorialField,
  type EditorialFieldErrors,
  zodFieldErrors,
} from "@/lib/editorial-form";

type ArticleEditorProps = {
  initial?: EditorialDraftInput & {
    articleId: string;
    revisionId: string;
    version: number;
    status: "draft" | "published" | "archived";
    slugManuallyEdited: boolean;
    slugLocked: boolean;
  };
  canPublish: boolean;
};

const initialActionState: EditorialActionState = { status: "idle" };
const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const editorialFieldByInputName: Partial<Record<string, EditorialField>> = {
  slug: "slug",
  title: "title",
  summary: "summary",
  category: "category",
  byline: "byline",
  eventDate: "eventDate",
  coverAlt: "coverAlt",
  seoTitle: "seoTitle",
  seoDescription: "seoDescription",
};

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
  seoTitle: "seo-title-error",
  seoDescription: "seo-description-error",
};

export function ArticleEditor({ initial, canPublish }: ArticleEditorProps) {
  const router = useRouter();
  const [actionState, formAction, pending] = useActionState(
    submitEditorialArticle,
    initialActionState,
  );
  const [bodyDocument, setBodyDocument] = useState<JSONContent>(() =>
    initial
      ? (() => {
          return {
            type: initial.body.type,
            content: initial.body.content,
          };
        })()
      : emptyDocument,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(
    initial?.slug ?? deriveEditorialSlug(initial?.title ?? ""),
  );
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    initial?.slugManuallyEdited ?? false,
  );
  const slugLocked = initial?.slugLocked ?? false;
  const [mediaId, setMediaId] = useState(initial?.coverMediaId ?? "");
  const [mediaState, setMediaState] = useState<
    "idle" | "uploading" | "processing" | "ready" | "error"
  >(initial?.coverMediaId ? "ready" : "idle");
  const [mediaMessage, setMediaMessage] = useState<string>();
  const [inlineMediaId, setInlineMediaId] = useState("");
  const [inlineAlt, setInlineAlt] = useState("");
  const [inlineMediaState, setInlineMediaState] = useState<
    "idle" | "uploading" | "processing" | "ready" | "error"
  >("idle");
  const [inlineMediaMessage, setInlineMediaMessage] = useState<string>();
  const [inlineAltError, setInlineAltError] = useState<string>();
  const [clientFieldErrors, setClientFieldErrors] =
    useState<EditorialFieldErrors>({});
  const [dismissedServerFields, setDismissedServerFields] = useState<
    Partial<Record<EditorialField, boolean>>
  >({});
  const [lifecycleMessage, setLifecycleMessage] = useState<string>();
  const [lifecycleError, setLifecycleError] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string>();
  const [previewPending, setPreviewPending] = useState(false);
  const [lifecyclePending, startLifecycleTransition] = useTransition();
  const fieldErrors: EditorialFieldErrors = { ...clientFieldErrors };
  if (actionState.status === "validation_error") {
    for (const [field, messages] of Object.entries(
      actionState.fieldErrors,
    ) as Array<[EditorialField, string[]]>) {
      if (!dismissedServerFields[field] && !fieldErrors[field]) {
        fieldErrors[field] = messages;
      }
    }
  }

  const editor = useEditor({
    extensions: createEditorialTiptapExtensions(),
    content: bodyDocument,
    immediatelyRender: false,
    onUpdate({ editor: currentEditor }) {
      setBodyDocument(currentEditor.getJSON());
    },
    editorProps: {
      attributes: {
        "aria-label": "Corpo da matéria",
        class: "prose-editor",
      },
    },
  });

  useEffect(() => {
    if (!initial && actionState.status === "success") {
      router.replace(`/articles/${actionState.data.articleId}/edit`);
    }
  }, [actionState, initial, router]);

  useEffect(() => {
    if (actionState.status === "validation_error") {
      focusFirstInvalidField(actionState.fieldErrors);
    }
  }, [actionState]);

  function clearFieldError(field: EditorialField) {
    setClientFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setDismissedServerFields((current) => ({ ...current, [field]: true }));
  }

  function focusFirstInvalidField(errors: EditorialFieldErrors) {
    const firstField = Object.keys(errors)[0] as EditorialField | undefined;
    if (!firstField) return;
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-editorial-field="${firstField}"]`)
        ?.focus({ preventScroll: true });
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget);
    if (submitter?.name) data.set(submitter.name, submitter.value);
    try {
      parseEditorialFormData(data);
      setClientFieldErrors({});
      setDismissedServerFields({});
    } catch (error) {
      event.preventDefault();
      const nextErrors = zodFieldErrors(error);
      setClientFieldErrors(nextErrors);
      setDismissedServerFields({});
      focusFirstInvalidField(nextErrors);
      return;
    }
    if (
      submitter?.value === "publish" &&
      !window.confirm(`Publicar “${title}” em /atualizacoes/${slug}?`)
    ) {
      event.preventDefault();
    }
  }

  async function uploadCover(file: File) {
    setMediaMessage(undefined);
    setMediaState("uploading");
    try {
      const upload = await createMediaUploadAction({
        mimeType: file.type,
        byteSize: file.size,
      });
      if (upload.status !== "success") {
        setMediaState("error");
        setMediaMessage(upload.message);
        return;
      }
      const response = await fetch(upload.data.uploadUrl, {
        method: "PUT",
        headers: upload.data.requiredHeaders,
        body: file,
      });
      if (!response.ok) {
        setMediaState("error");
        setMediaMessage("A transferência da capa falhou. Tente novamente.");
        return;
      }
      setMediaState("processing");
      const processed = await processMediaUploadAction(upload.data.mediaId);
      if (processed.status !== "success") {
        setMediaState("error");
        setMediaMessage(processed.message);
        return;
      }
      setMediaId(processed.data.id);
      setMediaState("ready");
      clearFieldError("coverMedia");
      setMediaMessage("Capa validada e convertida para WebP.");
    } catch {
      setMediaState("error");
      setMediaMessage(
        "Não foi possível processar a capa. Use JPEG, PNG ou WebP de até 10 MB.",
      );
    }
  }

  async function uploadInlineImage(file: File) {
    setInlineMediaMessage(undefined);
    setInlineMediaState("uploading");
    try {
      const upload = await createMediaUploadAction({
        mimeType: file.type,
        byteSize: file.size,
      });
      if (upload.status !== "success") {
        setInlineMediaState("error");
        setInlineMediaMessage(upload.message);
        return;
      }
      const response = await fetch(upload.data.uploadUrl, {
        method: "PUT",
        headers: upload.data.requiredHeaders,
        body: file,
      });
      if (!response.ok) {
        setInlineMediaState("error");
        setInlineMediaMessage(
          "A transferência da imagem inline falhou. Tente novamente.",
        );
        return;
      }
      setInlineMediaState("processing");
      const processed = await processMediaUploadAction(upload.data.mediaId);
      if (processed.status !== "success") {
        setInlineMediaState("error");
        setInlineMediaMessage(processed.message);
        return;
      }
      setInlineMediaId(processed.data.id);
      setInlineMediaState("ready");
    } catch {
      setInlineMediaState("error");
    }
  }

  function insertInlineImage() {
    if (!editor || inlineMediaState !== "ready") return;
    if (!inlineAlt.trim()) {
      setInlineAltError(
        "Informe o texto alternativo antes de inserir a imagem.",
      );
      document
        .querySelector<HTMLElement>(
          '[aria-label="Texto alternativo da imagem inline"]',
        )
        ?.focus();
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: { mediaId: inlineMediaId, alt: inlineAlt.trim() },
      })
      .run();
    setInlineMediaId("");
    setInlineAlt("");
    setInlineAltError(undefined);
    setInlineMediaState("idle");
  }

  function toggleLink() {
    if (!editor) return;
    const href = window.prompt(
      "URL do link (http, https, mailto ou caminho interno)",
    );
    if (href?.trim())
      editor.chain().focus().setLink({ href: href.trim() }).run();
  }

  function transitionLifecycle(intent: "unpublish" | "archive" | "restore") {
    if (!initial) return;
    const confirmation = {
      unpublish: "Despublicar esta matéria do Portal?",
      archive: "Arquivar esta matéria?",
      restore: "Restaurar esta matéria como rascunho?",
    }[intent];
    if (!window.confirm(confirmation)) return;
    startLifecycleTransition(async () => {
      const result = await transitionEditorialArticle({
        articleId: initial.articleId,
        expectedRevisionId: currentRevisionId,
        intent,
      });
      setLifecycleError(result.status !== "success");
      setLifecycleMessage(
        result.status === "success"
          ? "Ciclo de vida atualizado."
          : result.message,
      );
      if (result.status === "success") router.refresh();
    });
  }

  async function openPrivatePreview() {
    if (!initial) return;
    setPreviewPending(true);
    setPreviewMessage(undefined);
    try {
      const result = await createPrivatePreviewLink({
        articleId: initial.articleId,
        revisionId: currentRevisionId,
      });
      if (result.status === "success") {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        setPreviewMessage(result.message);
        if (result.status === "validation_error") {
          setClientFieldErrors(result.fieldErrors);
          setDismissedServerFields({});
          focusFirstInvalidField(result.fieldErrors);
        }
      }
    } catch {
      setPreviewMessage("Não foi possível abrir o preview no Portal.");
    } finally {
      setPreviewPending(false);
    }
  }

  const currentRevisionId =
    (actionState.status === "success"
      ? actionState.data.revisionId
      : undefined) ??
    initial?.revisionId ??
    "";
  const operationPending =
    pending ||
    lifecyclePending ||
    previewPending ||
    mediaState === "uploading" ||
    mediaState === "processing" ||
    inlineMediaState === "uploading" ||
    inlineMediaState === "processing";
  const actionMessage =
    actionState.status === "idle" ? undefined : actionState.message;
  const fieldErrorEntries = Object.entries(fieldErrors) as Array<
    [EditorialField, string[]]
  >;

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={handleSubmit}
      onChangeCapture={(event) => {
        const target = event.target;
        if (
          !(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLTextAreaElement) &&
          !(target instanceof HTMLSelectElement)
        ) {
          return;
        }
        const field = editorialFieldByInputName[target.name];
        if (field) clearFieldError(field);
      }}
      className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <input type="hidden" name="articleId" value={initial?.articleId ?? ""} />
      <input
        type="hidden"
        name="expectedRevisionId"
        value={currentRevisionId}
      />
      <input type="hidden" name="coverMediaId" value={mediaId} />
      <input
        type="hidden"
        name="slugManuallyEdited"
        value={String(slugManuallyEdited)}
      />
      <input
        type="hidden"
        name="bodyDocument"
        value={JSON.stringify(bodyDocument)}
      />

      <div className="grid min-w-0 gap-8">
        <section className="grid gap-5 rounded-xl border border-nite-border-subtle p-5 sm:p-6">
          <div className="grid gap-2">
            <label htmlFor="title" className="font-medium">
              Título
            </label>
            <Input
              id="title"
              name="title"
              maxLength={100}
              data-editorial-field="title"
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "title-error" : undefined}
              value={title}
              onChange={(event) => {
                const nextTitle = event.target.value;
                setTitle(nextTitle);
                if (!slugManuallyEdited && !slugLocked) {
                  setSlug(deriveEditorialSlug(nextTitle));
                }
              }}
            />
            {fieldErrors.title ? (
              <p id="title-error" className="text-sm text-status-error">
                {fieldErrors.title[0]}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <label htmlFor="summary" className="font-medium">
              Resumo
            </label>
            <Textarea
              id="summary"
              name="summary"
              maxLength={220}
              data-editorial-field="summary"
              aria-invalid={Boolean(fieldErrors.summary)}
              aria-describedby={
                fieldErrors.summary ? "summary-error" : undefined
              }
              defaultValue={initial?.summary}
            />
            {fieldErrors.summary ? (
              <p id="summary-error" className="text-sm text-status-error">
                {fieldErrors.summary[0]}
              </p>
            ) : null}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="slug" className="font-medium">
                Slug
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
                  fieldErrors.slug
                    ? "slug-error"
                    : slugLocked
                      ? "slug-lock-help"
                      : undefined
                }
                onChange={(event) => {
                  if (slugLocked) return;
                  setSlug(event.target.value);
                  setSlugManuallyEdited(true);
                }}
              />
              {fieldErrors.slug ? (
                <p id="slug-error" className="text-sm text-status-error">
                  {fieldErrors.slug[0]}
                </p>
              ) : null}
              {slugLocked ? (
                <p id="slug-lock-help" className="text-xs text-nite-text-muted">
                  O slug foi bloqueado permanentemente na primeira publicação.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <label htmlFor="category" className="font-medium">
                Categoria
              </label>
              <select
                id="category"
                name="category"
                defaultValue={initial?.category ?? ""}
                data-editorial-field="category"
                aria-invalid={Boolean(fieldErrors.category)}
                aria-describedby={
                  fieldErrors.category ? "category-error" : undefined
                }
                className="nite-form-field h-10 rounded-xl border px-3 text-sm outline-none"
              >
                <option value="">Selecione</option>
                {newsCategoryValues.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {fieldErrors.category ? (
                <p id="category-error" className="text-sm text-status-error">
                  {fieldErrors.category[0]}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="editor-surface overflow-hidden rounded-xl border border-nite-border-subtle">
          <div className="flex flex-wrap gap-2 border-b border-nite-border-subtle bg-nite-section p-3">
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("paragraph") ?? false}
              onClick={() => editor?.chain().focus().setParagraph().run()}
            >
              Parágrafo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              Subtítulo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("heading", { level: 3 }) ?? false}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              Seção
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("bold") ?? false}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              Negrito
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("italic") ?? false}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              Itálico
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("bulletList") ?? false}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              Lista
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("orderedList") ?? false}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              Lista numerada
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("blockquote") ?? false}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              Citação
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("link") ?? false}
              onClick={toggleLink}
            >
              Link
            </Button>
            {editor?.isActive("link") ? (
              <Button
                type="button"
                size="sm"
                variant="quiet"
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                Remover link
              </Button>
            ) : null}
          </div>
          <div
            data-editorial-field="body"
            tabIndex={fieldErrors.body ? -1 : undefined}
            aria-invalid={Boolean(fieldErrors.body)}
            aria-describedby={fieldErrors.body ? "body-error" : undefined}
          >
            <EditorContent editor={editor} className="p-5 sm:p-7" />
          </div>
          {fieldErrors.body ? (
            <p
              id="body-error"
              className="border-t border-nite-border-subtle px-4 py-3 text-sm text-status-error"
            >
              {fieldErrors.body[0]}
            </p>
          ) : null}
          <div className="grid gap-3 border-t border-nite-border-subtle p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              aria-label="Imagem inline pronta"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={
                inlineMediaState === "uploading" ||
                inlineMediaState === "processing"
              }
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadInlineImage(file);
              }}
            />
            <Input
              aria-label="Texto alternativo da imagem inline"
              value={inlineAlt}
              aria-invalid={Boolean(inlineAltError)}
              aria-describedby={inlineAltError ? "inline-alt-error" : undefined}
              onChange={(event) => {
                setInlineAlt(event.target.value);
                setInlineAltError(undefined);
              }}
              placeholder="Texto alternativo obrigatório"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={inlineMediaState !== "ready"}
              onClick={insertInlineImage}
            >
              Inserir imagem
            </Button>
            {inlineAltError ? (
              <p
                id="inline-alt-error"
                role="alert"
                className="sm:col-span-3 text-sm text-status-error"
              >
                {inlineAltError}
              </p>
            ) : null}
            {inlineMediaState !== "idle" ? (
              <p
                role={inlineMediaState === "error" ? "alert" : "status"}
                className="sm:col-span-3 text-sm text-nite-text-secondary"
              >
                {inlineMediaMessage ??
                  (inlineMediaState === "ready"
                    ? "Imagem pronta para inserir."
                    : inlineMediaState === "error"
                      ? "Não foi possível processar a imagem inline."
                      : "Validando imagem…")}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="grid content-start gap-5 xl:sticky xl:top-24">
        <section className="grid gap-4 rounded-xl border border-nite-border-subtle p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading font-semibold">Publicação</h2>
            {initial ? (
              <StatusBadge
                status={
                  initial.status === "published" ? "done" : initial.status
                }
                label={`v${initial.version}`}
              />
            ) : null}
          </div>
          <div className="grid gap-2">
            <label htmlFor="byline" className="text-sm font-medium">
              Assinatura
            </label>
            <Input
              id="byline"
              name="byline"
              data-editorial-field="byline"
              aria-invalid={Boolean(fieldErrors.byline)}
              aria-describedby={fieldErrors.byline ? "byline-error" : undefined}
              defaultValue={initial?.byline ?? "Redação NITE"}
            />
            {fieldErrors.byline ? (
              <p id="byline-error" className="text-sm text-status-error">
                {fieldErrors.byline[0]}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <p className="self-end text-sm text-nite-text-secondary">
              Leitura calculada automaticamente ao salvar.
            </p>
            <div className="grid gap-2">
              <label htmlFor="eventDate" className="text-sm font-medium">
                Data do evento
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
                defaultValue={initial?.eventDate}
              />
              {fieldErrors.eventDate ? (
                <p id="event-date-error" className="text-sm text-status-error">
                  {fieldErrors.eventDate[0]}
                </p>
              ) : null}
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={initial?.featured}
              className="size-4 accent-[var(--nite-brand-primary)]"
            />
            Destacar no Nite News
          </label>
        </section>

        <section className="grid gap-4 rounded-xl border border-nite-border-subtle p-5">
          <h2 className="font-heading font-semibold">Capa</h2>
          <Input
            aria-label="Arquivo de capa"
            type="file"
            data-editorial-field="coverMedia"
            aria-invalid={Boolean(fieldErrors.coverMedia)}
            aria-describedby={
              fieldErrors.coverMedia ? "cover-media-error" : undefined
            }
            accept="image/jpeg,image/png,image/webp"
            disabled={mediaState === "uploading" || mediaState === "processing"}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void uploadCover(file);
            }}
          />
          {fieldErrors.coverMedia ? (
            <p id="cover-media-error" className="text-sm text-status-error">
              {fieldErrors.coverMedia[0]}
            </p>
          ) : null}
          <div className="grid gap-2">
            <label htmlFor="coverAlt" className="text-sm font-medium">
              Texto alternativo
            </label>
            <Textarea
              id="coverAlt"
              name="coverAlt"
              data-editorial-field="coverAlt"
              aria-invalid={Boolean(fieldErrors.coverAlt)}
              aria-describedby={
                fieldErrors.coverAlt ? "cover-alt-error" : undefined
              }
              defaultValue={initial?.coverAlt}
            />
            {fieldErrors.coverAlt ? (
              <p id="cover-alt-error" className="text-sm text-status-error">
                {fieldErrors.coverAlt[0]}
              </p>
            ) : null}
          </div>
          {mediaState !== "idle" ? (
            <p
              role={mediaState === "error" ? "alert" : "status"}
              className={
                mediaState === "error"
                  ? "text-sm text-status-error"
                  : "text-sm text-nite-text-secondary"
              }
            >
              {mediaMessage ??
                (mediaState === "uploading"
                  ? "Enviando arquivo…"
                  : mediaState === "processing"
                    ? "Validando e convertendo…"
                    : "Capa pronta.")}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 rounded-xl border border-nite-border-subtle p-5">
          <h2 className="font-heading font-semibold">SEO</h2>
          <Input
            aria-label="Título SEO"
            name="seoTitle"
            maxLength={60}
            data-editorial-field="seoTitle"
            aria-invalid={Boolean(fieldErrors.seoTitle)}
            aria-describedby={
              fieldErrors.seoTitle ? "seo-title-error" : undefined
            }
            defaultValue={initial?.seo?.title}
          />
          {fieldErrors.seoTitle ? (
            <p id="seo-title-error" className="text-sm text-status-error">
              {fieldErrors.seoTitle[0]}
            </p>
          ) : null}
          <Textarea
            aria-label="Descrição SEO"
            name="seoDescription"
            maxLength={160}
            data-editorial-field="seoDescription"
            aria-invalid={Boolean(fieldErrors.seoDescription)}
            aria-describedby={
              fieldErrors.seoDescription ? "seo-description-error" : undefined
            }
            defaultValue={initial?.seo?.description}
          />
          {fieldErrors.seoDescription ? (
            <p id="seo-description-error" className="text-sm text-status-error">
              {fieldErrors.seoDescription[0]}
            </p>
          ) : null}
        </section>

        {fieldErrorEntries.length > 0 ? (
          <section
            role="alert"
            aria-live="assertive"
            className="grid gap-2 rounded-xl border border-status-error/40 bg-status-error/5 p-4 text-sm text-status-error"
          >
            <p className="font-semibold">Revise os campos destacados.</p>
            <ul className="grid gap-1 pl-5">
              {fieldErrorEntries.map(([field, messages]) => (
                <li key={field} className="list-disc">
                  <a
                    href={`#${editorialFieldTarget[field]}`}
                    className="rounded-sm underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {messages[0]}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {actionMessage && actionState.status !== "validation_error" ? (
          <p
            role={actionState.status === "success" ? "status" : "alert"}
            className={
              actionState.status === "success"
                ? "text-sm text-status-done"
                : "text-sm text-status-error"
            }
          >
            {actionMessage}
            {actionState.status === "unexpected_error"
              ? ` Código de suporte: ${actionState.errorId}.`
              : null}
          </p>
        ) : null}
        {actionState.status === "conflict" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (
                window.confirm(
                  "Recarregar a versão atual? Alterações não salvas serão perdidas.",
                )
              ) {
                window.location.reload();
              }
            }}
          >
            Recarregar versão atual
          </Button>
        ) : null}
        {lifecycleMessage ? (
          <p
            role={lifecycleError ? "alert" : "status"}
            className={
              lifecycleError
                ? "text-sm text-status-error"
                : "text-sm text-nite-text-secondary"
            }
          >
            {lifecycleMessage}
          </p>
        ) : null}
        {previewMessage ? (
          <p role="alert" className="text-sm text-status-error">
            {previewMessage}
          </p>
        ) : null}

        <div className="grid gap-3">
          <Button
            type="submit"
            name="intent"
            value="save"
            variant="secondary"
            loading={pending}
            disabled={operationPending}
          >
            Salvar revisão
          </Button>
          {canPublish ? (
            <Button
              type="submit"
              name="intent"
              value="publish"
              loading={pending}
              disabled={operationPending}
            >
              Publicar revisão
            </Button>
          ) : null}
          {initial ? (
            <Link
              href={`/preview/articles/${initial.articleId}?revision=${currentRevisionId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-nite-border-soft px-4 py-2 text-sm font-semibold text-nite-text-secondary outline-none transition-colors hover:bg-nite-surface-subtle focus-visible:ring-2 focus-visible:ring-ring"
            >
              Preview no CMS
            </Link>
          ) : null}
          {initial ? (
            <Button
              type="button"
              onClick={() => void openPrivatePreview()}
              variant="quiet"
              loading={previewPending}
              disabled={operationPending}
            >
              Preview no Portal
            </Button>
          ) : null}
          {initial?.status === "published" ? (
            <Button
              type="button"
              variant="quiet"
              loading={lifecyclePending}
              disabled={operationPending}
              onClick={() => transitionLifecycle("unpublish")}
            >
              Despublicar
            </Button>
          ) : null}
          {initial && initial.status !== "archived" ? (
            <Button
              type="button"
              variant="quiet"
              loading={lifecyclePending}
              disabled={operationPending}
              onClick={() => transitionLifecycle("archive")}
            >
              Arquivar
            </Button>
          ) : null}
          {initial?.status === "archived" ? (
            <Button
              type="button"
              variant="quiet"
              loading={lifecyclePending}
              disabled={operationPending}
              onClick={() => transitionLifecycle("restore")}
            >
              Restaurar
            </Button>
          ) : null}
        </div>
      </aside>
    </form>
  );
}
