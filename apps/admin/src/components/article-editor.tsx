"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useEditor, type JSONContent } from "@tiptap/react";
import { deriveEditorialSlug, type EditorialDraftInput } from "@nite/editorial";
import {
  createMediaUploadAction,
  createLivePreviewLink,
  processMediaUploadAction,
  submitEditorialArticle,
  transitionEditorialArticle,
  type EditorialActionState,
} from "@/app/(workspace)/articles/actions";
import {
  createEditorialTiptapExtensions,
  normalizeEditorialPastedHtml,
} from "@/lib/editorial-tiptap";
import {
  parseEditorialFormData,
  type EditorialField,
  type EditorialFieldErrors,
  zodFieldErrors,
} from "@/lib/editorial-form";
import { EditorHeader } from "./editor/editor-header";
import { EditorCanvas } from "./editor/editor-canvas";
import { EditorInspector } from "./editor/editor-inspector";

type ArticleStatus = "draft" | "published" | "archived";

type RevisionItem = {
  id: string;
  version: number;
  title: string | null;
  createdAt: Date;
};

type ArticleEditorProps = {
  initial?: EditorialDraftInput & {
    articleId: string;
    revisionId: string;
    version: number;
    status: ArticleStatus;
    publishedRevisionId: string | null;
    slugManuallyEdited: boolean;
    slugLocked: boolean;
    coverUrl?: string;
  };
  canPublish: boolean;
  revisions?: RevisionItem[];
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
  coverCaption: "coverCaption",
  coverCredit: "coverCredit",
  seoTitle: "seoTitle",
  seoDescription: "seoDescription",
};

const editorialFocusOrder: EditorialField[] = [
  "title",
  "summary",
  "body",
  "category",
  "byline",
  "eventDate",
  "coverMedia",
  "coverAlt",
  "coverCaption",
  "coverCredit",
  "seoTitle",
  "seoDescription",
  "slug",
];

function documentText(node: JSONContent): string {
  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = node.content?.map(documentText).join(" ") ?? "";
  return `${ownText} ${childText}`.trim();
}

function statusPresentation(
  status: ArticleStatus | undefined,
  version: number | undefined,
  hasUnpublishedChanges: boolean,
) {
  if (!status || !version) {
    return { label: "Ainda não salva", status: "warning" as const };
  }
  if (status === "archived") {
    return { label: `Arquivada · v${version}`, status: "archived" as const };
  }
  if (status === "published" && hasUnpublishedChanges) {
    return {
      label: `Alterações não publicadas · v${version}`,
      status: "warning" as const,
    };
  }
  if (status === "published") {
    return { label: `Publicada · v${version}`, status: "done" as const };
  }
  return { label: `Rascunho · v${version}`, status: "draft" as const };
}

export function ArticleEditor({
  initial,
  canPublish,
  revisions = [],
}: ArticleEditorProps) {
  const router = useRouter();
  const isExisting = Boolean(initial);
  const handledRevisionId = useRef<string | undefined>(undefined);
  const [actionState, formAction, pending] = useActionState(
    submitEditorialArticle,
    initialActionState,
  );
  const [bodyDocument, setBodyDocument] = useState<JSONContent>(() =>
    initial
      ? { type: initial.body.type, content: initial.body.content }
      : emptyDocument,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [byline, setByline] = useState(initial?.byline ?? "Redação NITE");
  const [coverAlt, setCoverAlt] = useState(initial?.coverAlt ?? "");
  const [coverCaption, setCoverCaption] = useState(initial?.coverCaption ?? "");
  const [coverCredit, setCoverCredit] = useState(initial?.coverCredit ?? "");
  const [seoTitle, setSeoTitle] = useState(initial?.seo?.title ?? "");
  const [seoDescription, setSeoDescription] = useState(
    initial?.seo?.description ?? "",
  );
  const [slug, setSlug] = useState(
    initial?.slug ?? deriveEditorialSlug(initial?.title ?? ""),
  );
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    initial?.slugManuallyEdited ?? false,
  );
  const slugLocked = initial?.slugLocked ?? false;
  const [slugPanelOpen, setSlugPanelOpen] = useState(
    slugManuallyEdited || slugLocked,
  );
  const [seoPanelOpen, setSeoPanelOpen] = useState(Boolean(initial?.seo));
  const [mediaId, setMediaId] = useState(initial?.coverMediaId ?? "");
  const [mediaState, setMediaState] = useState<
    "idle" | "uploading" | "processing" | "ready" | "error"
  >(initial?.coverMediaId ? "ready" : "idle");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(initial?.coverUrl);
  const [mediaMessage, setMediaMessage] = useState<string>();
  const [inlinePanelOpen, setInlinePanelOpen] = useState(false);
  const [inlineMediaId, setInlineMediaId] = useState("");
  const [inlineAlt, setInlineAlt] = useState("");
  const [inlineCaption, setInlineCaption] = useState("");
  const [inlineCredit, setInlineCredit] = useState("");
  const [inlineLayout, setInlineLayout] = useState<"normal" | "wide" | "full">(
    "normal",
  );
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
  const [isDirty, setIsDirty] = useState(!initial);
  const [, setSelectionRevision] = useState(0);
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
      setIsDirty(true);
    },
    onSelectionUpdate() {
      setSelectionRevision((revision) => revision + 1);
    },
    editorProps: {
      transformPastedHTML: normalizeEditorialPastedHtml,
      attributes: {
        "aria-label": "Corpo da matéria",
        class: "prose-editor",
      },
    },
  });

  useEffect(() => {
    if (!isDirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [isDirty]);

  const successfulSave =
    actionState.status === "success" ? actionState.data : undefined;
  const currentRevisionId =
    successfulSave?.revisionId ?? initial?.revisionId ?? "";
  const currentVersion = successfulSave?.version ?? initial?.version;
  const currentStatus = successfulSave?.status ?? initial?.status;
  const publishedRevisionId =
    successfulSave?.publishedRevisionId ?? initial?.publishedRevisionId ?? null;
  const hasUnpublishedChanges =
    currentStatus === "published" &&
    publishedRevisionId !== null &&
    publishedRevisionId !== currentRevisionId;
  const status = statusPresentation(
    currentStatus,
    currentVersion,
    hasUnpublishedChanges,
  );

  useEffect(() => {
    if (
      actionState.status !== "success" ||
      handledRevisionId.current === actionState.data.revisionId
    ) {
      return;
    }
    handledRevisionId.current = actionState.data.revisionId;
    setIsDirty(false);
    if (isExisting) {
      router.refresh();
    } else {
      router.replace(`/articles/${actionState.data.articleId}/edit`);
    }
  }, [actionState, isExisting, router]);

  useEffect(
    () => () => {
      if (coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    },
    [coverPreviewUrl],
  );

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
    const firstField = editorialFocusOrder.find((field) => errors[field]);
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
    setIsDirty(true);
    if (typeof URL.createObjectURL === "function") {
      setCoverPreviewUrl(URL.createObjectURL(file));
    }
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
      setInlineMediaMessage("Não foi possível processar a imagem inline.");
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
        attrs: {
          mediaId: inlineMediaId,
          alt: inlineAlt.trim(),
          ...(inlineCaption.trim() ? { caption: inlineCaption.trim() } : {}),
          ...(inlineCredit.trim() ? { credit: inlineCredit.trim() } : {}),
          layout: inlineLayout,
        },
      })
      .run();
    setInlineMediaId("");
    setInlineAlt("");
    setInlineCaption("");
    setInlineCredit("");
    setInlineLayout("normal");
    setInlineAltError(undefined);
    setInlineMediaState("idle");
    setInlinePanelOpen(false);
    setIsDirty(true);
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

  async function openLivePreview(target: "cms" | "portal") {
    if (!initial) return;
    const form = document.getElementById("article-editor-form");
    if (!(form instanceof HTMLFormElement)) return;
    setPreviewPending(true);
    setPreviewMessage(undefined);
    try {
      const data = new FormData(form);
      data.set("intent", "publish");
      const result = await createLivePreviewLink(target, data);
      if (result.status === "success") {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        setPreviewMessage(
          result.status === "unexpected_error"
            ? `${result.message} Código de suporte: ${result.errorId}.`
            : result.message,
        );
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
  const bodyText = useMemo(() => documentText(bodyDocument), [bodyDocument]);
  const wordCount = bodyText
    ? bodyText.split(/\s+/u).filter(Boolean).length
    : 0;
  const seoReady =
    (seoTitle.length === 0 && seoDescription.length === 0) ||
    (seoTitle.trim().length >= 20 &&
      seoDescription.trim().length >= 80 &&
      seoDescription.trim().length <= 160);
  const preparationItems = [
    { label: "Rascunho iniciado", complete: true },
    {
      label: "Título e resumo",
      complete: title.trim().length >= 12 && summary.trim().length >= 48,
    },
    { label: "Conteúdo da matéria", complete: bodyText.length > 0 },
    {
      label: "Categoria e assinatura",
      complete: category !== "" && byline.trim().length >= 3,
    },
    {
      label: "Capa e texto alternativo",
      complete:
        mediaState === "ready" &&
        mediaId.length > 0 &&
        coverAlt.trim().length >= 12,
    },
  ];
  const readyForFinalReview =
    preparationItems.slice(1).every((item) => item.complete) &&
    slug.length >= 3 &&
    seoReady;
  const completePreparationItems = [
    ...preparationItems,
    { label: "Revisão final", complete: readyForFinalReview },
  ];
  const preparationCount = completePreparationItems.filter(
    (item) => item.complete,
  ).length;

  return (
    <form
      id="article-editor-form"
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
        setIsDirty(true);
        const field = editorialFieldByInputName[target.name];
        if (field) clearFieldError(field);
      }}
      className="flex flex-col min-h-[calc(100vh-60px)]"
    >
      <EditorHeader
        isExisting={isExisting}
        articleId={initial?.articleId}
        status={status}
        pending={pending}
        operationPending={operationPending}
        canPublish={canPublish}
        currentStatus={currentStatus}
        openLivePreview={(target) => void openLivePreview(target)}
      />

      <div className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] xl:overflow-hidden">
        {/* Hidden Form Inputs */}
        <input
          type="hidden"
          name="articleId"
          value={initial?.articleId ?? ""}
        />
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

        {/* Central Writing Canvas: focused on ~760px, scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px]">
            <EditorCanvas
              title={title}
              summary={summary}
              fieldErrors={fieldErrors}
              editor={editor}
              inlinePanelOpen={inlinePanelOpen}
              inlineMediaState={inlineMediaState}
              inlineMediaMessage={inlineMediaMessage}
              inlineAlt={inlineAlt}
              inlineCaption={inlineCaption}
              inlineCredit={inlineCredit}
              inlineLayout={inlineLayout}
              inlineAltError={inlineAltError}
              wordCount={wordCount}
              isDirty={isDirty}
              onTitleChange={(nextTitle) => {
                setTitle(nextTitle);
                if (!slugManuallyEdited && !slugLocked) {
                  setSlug(deriveEditorialSlug(nextTitle));
                }
              }}
              onSummaryChange={(nextSummary) => setSummary(nextSummary)}
              onToggleInlinePanel={() => setInlinePanelOpen((open) => !open)}
              onInlineAltChange={(value) => {
                setInlineAlt(value);
                setInlineAltError(undefined);
              }}
              onInlineCaptionChange={setInlineCaption}
              onInlineCreditChange={setInlineCredit}
              onInlineLayoutChange={setInlineLayout}
              onInlineFileSelect={(file) => void uploadInlineImage(file)}
              onInsertInlineImage={insertInlineImage}
            />
          </div>
        </div>

        {/* Right Inspector Rail: ~350px, independent scroll, border-l */}
        <div className="w-full xl:w-[350px] xl:shrink-0 xl:border-l border-nite-border-subtle bg-nite-surface xl:overflow-y-auto p-4 sm:p-5">
          <EditorInspector
            title={title}
            summary={summary}
            isExisting={isExisting}
            articleId={initial?.articleId}
            currentRevisionId={currentRevisionId}
            publishedRevisionId={publishedRevisionId}
            currentStatus={currentStatus}
            revisions={revisions}
            fieldErrors={fieldErrors}
            preparationCount={preparationCount}
            readyForFinalReview={readyForFinalReview}
            completePreparationItems={completePreparationItems}
            category={category}
            byline={byline}
            eventDate={initial?.eventDate}
            featured={initial?.featured}
            slug={slug}
            slugLocked={slugLocked}
            slugPanelOpen={slugPanelOpen}
            coverPreviewUrl={coverPreviewUrl}
            coverAlt={coverAlt}
            coverCaption={coverCaption}
            coverCredit={coverCredit}
            mediaState={mediaState}
            mediaMessage={mediaMessage}
            seoTitle={seoTitle}
            seoDescription={seoDescription}
            seoPanelOpen={seoPanelOpen}
            operationPending={operationPending}
            lifecyclePending={lifecyclePending}
            lifecycleMessage={lifecycleMessage}
            lifecycleError={lifecycleError}
            previewMessage={previewMessage}
            actionMessage={actionMessage}
            actionStatus={actionState.status}
            actionErrorId={
              actionState.status === "unexpected_error"
                ? actionState.errorId
                : undefined
            }
            onCategoryChange={(val) => setCategory(val)}
            onBylineChange={(val) => setByline(val)}
            onSlugChange={(val) => {
              if (slugLocked) return;
              setSlug(val);
              setSlugManuallyEdited(true);
            }}
            onSlugToggle={(open) => setSlugPanelOpen(open)}
            onCoverFileSelect={(file) => void uploadCover(file)}
            onCoverAltChange={(val) => setCoverAlt(val)}
            onCoverCaptionChange={(val) => setCoverCaption(val)}
            onCoverCreditChange={(val) => setCoverCredit(val)}
            onSeoTitleChange={(val) => setSeoTitle(val)}
            onSeoDescriptionChange={(val) => setSeoDescription(val)}
            onSeoToggle={(open) => setSeoPanelOpen(open)}
            onTransitionLifecycle={transitionLifecycle}
          />
        </div>
      </div>
    </form>
  );
}
