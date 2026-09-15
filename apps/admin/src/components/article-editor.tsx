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
  createPrivatePreviewLink,
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
  MediaUploadCanceledError,
  uploadMediaFile,
} from "@/lib/media-upload-client";
import {
  parseEditorialFormData,
  type EditorialField,
  type EditorialFieldErrors,
  zodFieldErrors,
} from "@/lib/editorial-form";
import { EditorHeader } from "./editor/editor-header";
import { EditorCanvas } from "./editor/editor-canvas";
import { EditorInspector } from "./editor/editor-inspector";
import { EditorialConfirmDialog } from "./editor/editorial-confirm-dialog";

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
  canDelete?: boolean;
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
  canDelete = false,
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
  const [videoPanelOpen, setVideoPanelOpen] = useState(false);
  const [videoMediaId, setVideoMediaId] = useState("");
  const [captionsMediaId, setCaptionsMediaId] = useState("");
  const [videoState, setVideoState] = useState<
    "idle" | "uploading" | "processing" | "ready" | "error"
  >("idle");
  const [captionsState, setCaptionsState] = useState<
    "idle" | "uploading" | "processing" | "ready" | "error"
  >("idle");
  const [videoProgress, setVideoProgress] = useState(0);
  const [captionsProgress, setCaptionsProgress] = useState(0);
  const [videoMessage, setVideoMessage] = useState<string>();
  const [captionsMessage, setCaptionsMessage] = useState<string>();
  const [videoPlaybackMode, setVideoPlaybackMode] = useState<
    "autoplay" | "manual"
  >("manual");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [videoCredit, setVideoCredit] = useState("");
  const [videoLayout, setVideoLayout] = useState<"normal" | "wide" | "full">(
    "normal",
  );
  const [videoDurationMs, setVideoDurationMs] = useState<number>();
  const [videoHasAudio, setVideoHasAudio] = useState<boolean>();
  const [videoReplacementPending, setVideoReplacementPending] = useState(false);
  const [videoReplacementMessage, setVideoReplacementMessage] =
    useState<string>();
  const videoAbortRef = useRef<AbortController | null>(null);
  const captionsAbortRef = useRef<AbortController | null>(null);
  const lastVideoFileRef = useRef<File | null>(null);
  const lastCaptionsFileRef = useRef<File | null>(null);
  const [clientFieldErrors, setClientFieldErrors] =
    useState<EditorialFieldErrors>({});
  const [dismissedServerFields, setDismissedServerFields] = useState<
    Partial<Record<EditorialField, boolean>>
  >({});
  const [lifecycleMessage, setLifecycleMessage] = useState<string>();
  const [lifecycleError, setLifecycleError] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string>();
  const [previewPending, setPreviewPending] = useState(false);
  const [deletionPending, setDeletionPending] = useState(false);
  const [isDirty, setIsDirty] = useState(!initial);
  const [, setSelectionRevision] = useState(0);
  const [lifecyclePending, startLifecycleTransition] = useTransition();
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const confirmedPublishRef = useRef(false);
  const [lifecycleIntent, setLifecycleIntent] = useState<
    "unpublish" | "archive" | "restore" | null
  >(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorMode, setInspectorMode] = useState<"drawer" | "sheet">(
    "drawer",
  );
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const updateMode = () => {
      setInspectorMode(window.innerWidth < 768 ? "sheet" : "drawer");
    };
    updateMode();
    window.addEventListener("resize", updateMode);
    return () => window.removeEventListener("resize", updateMode);
  }, []);

  const handleCloseInspector = () => {
    setIsInspectorOpen(false);
    inspectorTriggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isInspectorOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseInspector();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInspectorOpen]);

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
    if (submitter?.value === "publish") {
      if (!confirmedPublishRef.current) {
        event.preventDefault();
        setPublishDialogOpen(true);
        return;
      }
      confirmedPublishRef.current = false;
    }
  }

  function handleConfirmPublish() {
    confirmedPublishRef.current = true;
    setPublishDialogOpen(false);
    const form = formRef.current;
    if (form) {
      const publishButton = form.querySelector<HTMLButtonElement>(
        'button[name="intent"][value="publish"]',
      );
      if (publishButton && typeof form.requestSubmit === "function") {
        form.requestSubmit(publishButton);
      } else if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      }
    }
  }

  async function uploadAndProcessMedia(
    file: File,
    mediaKind: "image" | "video" | "captions",
    signal?: AbortSignal,
    onProgress?: (percentage: number) => void,
    onUploaded?: () => void,
  ) {
    const upload = await createMediaUploadAction({
      mediaKind,
      mimeType: file.type,
      byteSize: file.size,
    });
    if (upload.status !== "success") throw new Error(upload.message);
    await uploadMediaFile({
      url: upload.data.uploadUrl,
      headers: upload.data.requiredHeaders,
      file,
      signal,
      onProgress,
    });
    onUploaded?.();
    const processed = await processMediaUploadAction(upload.data.mediaId);
    if (processed.status !== "success") throw new Error(processed.message);
    return processed.data;
  }

  async function uploadCover(file: File) {
    setMediaMessage(undefined);
    setMediaState("uploading");
    setIsDirty(true);
    if (typeof URL.createObjectURL === "function") {
      setCoverPreviewUrl(URL.createObjectURL(file));
    }
    try {
      const processed = await uploadAndProcessMedia(
        file,
        "image",
        undefined,
        undefined,
        () => setMediaState("processing"),
      );
      setMediaId(processed.id);
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
      const processed = await uploadAndProcessMedia(
        file,
        "image",
        undefined,
        undefined,
        () => setInlineMediaState("processing"),
      );
      setInlineMediaId(processed.id);
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

  async function uploadVideo(file: File) {
    lastVideoFileRef.current = file;
    videoAbortRef.current?.abort();
    const controller = new AbortController();
    videoAbortRef.current = controller;
    setVideoState("uploading");
    setVideoProgress(0);
    setVideoMessage("Enviando MP4…");
    try {
      const processed = await uploadAndProcessMedia(
        file,
        "video",
        controller.signal,
        setVideoProgress,
        () => {
          setVideoState("processing");
          setVideoMessage("Validando H.264, áudio e fast-start…");
        },
      );
      if (processed.mediaKind !== "video") {
        throw new Error("A mídia processada não é um vídeo.");
      }
      setVideoMediaId(processed.id);
      setVideoDurationMs(processed.durationMs ?? undefined);
      setVideoHasAudio(processed.hasAudio ?? undefined);
      setVideoState("ready");
      setVideoMessage("Vídeo MP4 pronto para inserir.");
    } catch (error) {
      if (error instanceof MediaUploadCanceledError) {
        setVideoState("idle");
        setVideoMessage("Upload do vídeo cancelado.");
      } else {
        setVideoState("error");
        setVideoMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível processar o vídeo.",
        );
      }
    } finally {
      if (videoAbortRef.current === controller) videoAbortRef.current = null;
    }
  }

  async function uploadCaptions(file: File) {
    lastCaptionsFileRef.current = file;
    captionsAbortRef.current?.abort();
    const controller = new AbortController();
    captionsAbortRef.current = controller;
    setCaptionsState("uploading");
    setCaptionsProgress(0);
    setCaptionsMessage("Enviando WebVTT…");
    try {
      const processed = await uploadAndProcessMedia(
        file,
        "captions",
        controller.signal,
        setCaptionsProgress,
        () => {
          setCaptionsState("processing");
          setCaptionsMessage("Validando cues e timestamps…");
        },
      );
      if (processed.mediaKind !== "captions") {
        throw new Error("A mídia processada não é uma legenda WebVTT.");
      }
      setCaptionsMediaId(processed.id);
      setCaptionsState("ready");
      setCaptionsMessage("Legenda WebVTT pt-BR pronta.");
    } catch (error) {
      if (error instanceof MediaUploadCanceledError) {
        setCaptionsState("idle");
        setCaptionsMessage("Upload da legenda cancelado.");
      } else {
        setCaptionsState("error");
        setCaptionsMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível processar a legenda.",
        );
      }
    } finally {
      if (captionsAbortRef.current === controller) {
        captionsAbortRef.current = null;
      }
    }
  }

  function insertVideo() {
    if (!editor || videoState !== "ready" || !videoMediaId) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "video",
        attrs: {
          mediaId: videoMediaId,
          ...(captionsState === "ready" && captionsMediaId
            ? { captionsMediaId }
            : {}),
          playbackMode: videoPlaybackMode,
          layout: videoLayout,
          ...(videoDescription.trim()
            ? { description: videoDescription.trim() }
            : {}),
          ...(videoCaption.trim() ? { caption: videoCaption.trim() } : {}),
          ...(videoCredit.trim() ? { credit: videoCredit.trim() } : {}),
        },
      })
      .run();
    setVideoMediaId("");
    setCaptionsMediaId("");
    setVideoState("idle");
    setCaptionsState("idle");
    setVideoProgress(0);
    setCaptionsProgress(0);
    setVideoMessage(undefined);
    setCaptionsMessage(undefined);
    setVideoDescription("");
    setVideoCaption("");
    setVideoCredit("");
    setVideoLayout("normal");
    setVideoDurationMs(undefined);
    setVideoHasAudio(undefined);
    setVideoPanelOpen(false);
    setIsDirty(true);
  }

  async function replaceSelectedVideo(file: File) {
    if (!editor?.isActive("video")) return;
    setVideoReplacementPending(true);
    setVideoReplacementMessage("Substituindo vídeo…");
    try {
      const processed = await uploadAndProcessMedia(file, "video");
      if (processed.mediaKind !== "video")
        throw new Error("Mídia incompatível.");
      editor
        .chain()
        .focus()
        .updateAttributes("video", { mediaId: processed.id })
        .run();
      setVideoReplacementMessage("Vídeo substituído.");
      setIsDirty(true);
    } catch (error) {
      setVideoReplacementMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível substituir o vídeo.",
      );
    } finally {
      setVideoReplacementPending(false);
    }
  }

  async function replaceSelectedCaptions(file: File) {
    if (!editor?.isActive("video")) return;
    setVideoReplacementPending(true);
    setVideoReplacementMessage("Substituindo legenda…");
    try {
      const processed = await uploadAndProcessMedia(file, "captions");
      if (processed.mediaKind !== "captions")
        throw new Error("Mídia incompatível.");
      editor
        .chain()
        .focus()
        .updateAttributes("video", { captionsMediaId: processed.id })
        .run();
      setVideoReplacementMessage("Legenda WebVTT substituída.");
      setIsDirty(true);
    } catch (error) {
      setVideoReplacementMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível substituir a legenda.",
      );
    } finally {
      setVideoReplacementPending(false);
    }
  }

  function transitionLifecycle(intent: "unpublish" | "archive" | "restore") {
    if (!initial) return;
    setLifecycleIntent(intent);
  }

  function handleConfirmLifecycle() {
    if (!initial || !lifecycleIntent) return;
    const intent = lifecycleIntent;
    setLifecycleIntent(null);
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

  async function openRevisionPreview(revisionId: string) {
    if (!initial) return;
    setPreviewPending(true);
    setPreviewMessage(undefined);
    try {
      const result = await createPrivatePreviewLink({
        articleId: initial.articleId,
        revisionId,
      });
      if (result.status === "success") {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        setPreviewMessage(
          result.status === "unexpected_error"
            ? `${result.message} Código de suporte: ${result.errorId}.`
            : result.message,
        );
      }
    } catch {
      setPreviewMessage("Não foi possível abrir esta versão no Portal.");
    } finally {
      setPreviewPending(false);
    }
  }

  const operationPending =
    pending ||
    lifecyclePending ||
    previewPending ||
    deletionPending ||
    mediaState === "uploading" ||
    mediaState === "processing" ||
    inlineMediaState === "uploading" ||
    inlineMediaState === "processing" ||
    videoState === "uploading" ||
    videoState === "processing" ||
    captionsState === "uploading" ||
    captionsState === "processing" ||
    videoReplacementPending;
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

  const commonInspectorProps = {
    title,
    summary,
    isExisting,
    articleId: initial?.articleId,
    currentRevisionId,
    publishedRevisionId,
    currentStatus,
    revisions,
    fieldErrors,
    preparationCount,
    readyForFinalReview,
    completePreparationItems,
    category,
    byline,
    eventDate: initial?.eventDate,
    featured: initial?.featured,
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
    onCategoryChange: (val: typeof category) => setCategory(val),
    onBylineChange: (val: string) => setByline(val),
    onSlugChange: (val: string) => {
      if (slugLocked) return;
      setSlug(val);
      setSlugManuallyEdited(true);
    },
    onSlugToggle: (open: boolean) => setSlugPanelOpen(open),
    onCoverFileSelect: (file: File) => void uploadCover(file),
    onCoverAltChange: (val: string) => setCoverAlt(val),
    onCoverCaptionChange: (val: string) => setCoverCaption(val),
    onCoverCreditChange: (val: string) => setCoverCredit(val),
    onSeoTitleChange: (val: string) => setSeoTitle(val),
    onSeoDescriptionChange: (val: string) => setSeoDescription(val),
    onSeoToggle: (open: boolean) => setSeoPanelOpen(open),
    onTransitionLifecycle: transitionLifecycle,
    onViewRevision: (revisionId: string) =>
      void openRevisionPreview(revisionId),
    onDeletionPendingChange: setDeletionPending,
    onDeleted: (scheduledMediaCount: number) => {
      setIsDirty(false);
      router.replace(`/?deletedMedia=${scheduledMediaCount}`);
    },
  };

  return (
    <form
      id="article-editor-form"
      ref={formRef}
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
        hasUnpublishedChanges={hasUnpublishedChanges}
        openLivePreview={(target) => void openLivePreview(target)}
      />

      {/* Faixa de Notificações / Status Banner com aria-live="polite" */}
      {previewMessage ? (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 border-b border-status-warning/40 bg-status-warning/10 px-4 py-2 text-xs text-nite-text-primary sm:px-6 lg:px-8"
        >
          <span>{previewMessage}</span>
          <button
            type="button"
            onClick={() => setPreviewMessage(undefined)}
            aria-label="Fechar aviso"
            className="text-xs text-nite-text-secondary hover:text-nite-text-primary"
          >
            ✕
          </button>
        </div>
      ) : null}

      {Object.keys(fieldErrors).length > 0 ? (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 border-b border-status-error/30 bg-status-error/10 px-4 py-2 text-xs text-status-error sm:px-6 lg:px-8"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Revise os campos destacados.</span>
            <span className="hidden text-status-error/80 sm:inline">
              Existem dados pendentes que impedem a publicação.
            </span>
          </div>
          <button
            type="button"
            onClick={() => focusFirstInvalidField(fieldErrors)}
            className="shrink-0 text-xs font-medium underline hover:text-red-800"
          >
            Ir para o primeiro campo
          </button>
        </div>
      ) : null}

      {lifecycleMessage ? (
        <div
          role={lifecycleError ? "alert" : "status"}
          aria-live="polite"
          className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs sm:px-6 lg:px-8 ${
            lifecycleError
              ? "border-status-error/30 bg-status-error/10 text-status-error"
              : "border-status-done/30 bg-status-done/10 text-status-done"
          }`}
        >
          <span>{lifecycleMessage}</span>
          <button
            type="button"
            onClick={() => setLifecycleMessage(undefined)}
            aria-label="Fechar aviso"
            className="text-xs opacity-75 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ) : null}

      {actionMessage &&
      actionState.status !== "idle" &&
      actionState.status !== "validation_error" ? (
        <div
          role={actionState.status !== "success" ? "alert" : "status"}
          aria-live="polite"
          className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs sm:px-6 lg:px-8 ${
            actionState.status !== "success"
              ? "border-status-error/30 bg-status-error/10 text-status-error"
              : "border-status-done/30 bg-status-done/10 text-status-done"
          }`}
        >
          <span>{actionMessage}</span>
        </div>
      ) : null}

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
              videoPanelOpen={videoPanelOpen}
              videoState={videoState}
              videoProgress={videoProgress}
              videoMessage={videoMessage}
              captionsState={captionsState}
              captionsProgress={captionsProgress}
              captionsMessage={captionsMessage}
              videoPlaybackMode={videoPlaybackMode}
              videoDescription={videoDescription}
              videoCaption={videoCaption}
              videoCredit={videoCredit}
              videoLayout={videoLayout}
              videoDurationMs={videoDurationMs}
              videoHasAudio={videoHasAudio}
              videoReplacementPending={videoReplacementPending}
              videoReplacementMessage={videoReplacementMessage}
              wordCount={wordCount}
              isDirty={isDirty}
              onTitleChange={(nextTitle) => {
                setTitle(nextTitle);
                if (!slugManuallyEdited && !slugLocked) {
                  setSlug(deriveEditorialSlug(nextTitle));
                }
              }}
              onSummaryChange={(nextSummary) => setSummary(nextSummary)}
              onToggleInlinePanel={() => {
                setInlinePanelOpen((open) => !open);
                setVideoPanelOpen(false);
              }}
              onInlineAltChange={(value) => {
                setInlineAlt(value);
                setInlineAltError(undefined);
              }}
              onInlineCaptionChange={setInlineCaption}
              onInlineCreditChange={setInlineCredit}
              onInlineLayoutChange={setInlineLayout}
              onInlineFileSelect={(file) => void uploadInlineImage(file)}
              onInsertInlineImage={insertInlineImage}
              onToggleVideoPanel={() => {
                setVideoPanelOpen((open) => !open);
                setInlinePanelOpen(false);
              }}
              onVideoFileSelect={(file) => void uploadVideo(file)}
              onCaptionsFileSelect={(file) => void uploadCaptions(file)}
              onCancelVideo={() => videoAbortRef.current?.abort()}
              onCancelCaptions={() => captionsAbortRef.current?.abort()}
              onRetryVideo={() => {
                const file = lastVideoFileRef.current;
                if (file) void uploadVideo(file);
              }}
              onRetryCaptions={() => {
                const file = lastCaptionsFileRef.current;
                if (file) void uploadCaptions(file);
              }}
              onVideoPlaybackModeChange={setVideoPlaybackMode}
              onVideoDescriptionChange={setVideoDescription}
              onVideoCaptionChange={setVideoCaption}
              onVideoCreditChange={setVideoCredit}
              onVideoLayoutChange={setVideoLayout}
              onInsertVideo={insertVideo}
              onReplaceSelectedVideo={(file) => void replaceSelectedVideo(file)}
              onReplaceSelectedCaptions={(file) =>
                void replaceSelectedCaptions(file)
              }
            />
          </div>
        </div>

        {/* Right Inspector Rail: ~350px, independent scroll, border-l */}
        <div className="hidden xl:block xl:w-[350px] xl:shrink-0 xl:border-l border-nite-border-subtle bg-nite-surface xl:overflow-y-auto p-4 sm:p-5">
          <EditorInspector mode="rail" {...commonInspectorProps} />
        </div>
      </div>

      {/* Sticky Bottom Bar for screens < 1280px */}
      <div className="sticky bottom-0 z-30 flex items-center justify-between border-t border-nite-border-subtle bg-nite-surface/95 px-4 py-2.5 shadow-md backdrop-blur xl:hidden">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-nite-text-primary">
            Preparação {preparationCount}/6
          </span>
          {Object.keys(fieldErrors).length > 0 ? (
            <span className="rounded bg-status-error/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-error">
              {Object.keys(fieldErrors).length}{" "}
              {Object.keys(fieldErrors).length === 1
                ? "pendência"
                : "pendências"}
            </span>
          ) : readyForFinalReview ? (
            <span className="rounded bg-status-done/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-done">
              Pronta
            </span>
          ) : null}
        </div>
        <button
          ref={inspectorTriggerRef}
          type="button"
          onClick={() => setIsInspectorOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isInspectorOpen}
          className="inline-flex items-center gap-1.5 rounded-md border border-nite-border-subtle bg-nite-surface px-3 py-1.5 text-xs font-semibold text-nite-text-primary shadow-xs hover:bg-nite-section"
        >
          <span>Configurações</span>
        </button>
      </div>

      {/* Responsive Inspector Overlay: Drawer (tablet) or Sheet (mobile) */}
      {isInspectorOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Configurações da matéria"
          className="fixed inset-0 z-50 xl:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={handleCloseInspector}
            aria-hidden="true"
          />

          {/* Modal content */}
          <div
            className={`fixed z-50 bg-nite-surface shadow-2xl overflow-y-auto p-4 sm:p-5 transition-transform ${
              inspectorMode === "sheet"
                ? "inset-x-0 bottom-0 top-12 rounded-t-xl border-t border-nite-border-subtle"
                : "inset-y-0 right-0 w-full max-w-[380px] border-l border-nite-border-subtle"
            }`}
          >
            <EditorInspector
              mode={inspectorMode}
              onClose={handleCloseInspector}
              {...commonInspectorProps}
            />
          </div>
        </div>
      ) : null}

      {/* Dialogs */}
      <EditorialConfirmDialog
        open={publishDialogOpen}
        title={
          currentStatus === "published"
            ? "Publicar alterações no Portal?"
            : "Publicar matéria no Portal?"
        }
        description={`A matéria “${title || "Sem título"}” ficará visível publicamente em /atualizacoes/${slug}.`}
        confirmLabel="Confirmar publicação"
        cancelLabel="Continuar editando"
        variant="primary"
        pending={pending}
        onConfirm={handleConfirmPublish}
        onCancel={() => setPublishDialogOpen(false)}
      />

      <EditorialConfirmDialog
        open={lifecycleIntent !== null}
        title={
          lifecycleIntent === "unpublish"
            ? "Despublicar matéria?"
            : lifecycleIntent === "archive"
              ? "Arquivar matéria?"
              : "Restaurar matéria como rascunho?"
        }
        description={
          lifecycleIntent === "unpublish"
            ? "A matéria sairá do ar e não ficará visível no Portal NITE."
            : lifecycleIntent === "archive"
              ? "A matéria será arquivada e não ficará visível no Portal NITE."
              : "A matéria retornará ao status de rascunho para edição."
        }
        confirmLabel={
          lifecycleIntent === "unpublish"
            ? "Despublicar matéria"
            : lifecycleIntent === "archive"
              ? "Arquivar matéria"
              : "Restaurar rascunho"
        }
        cancelLabel="Cancelar"
        variant={lifecycleIntent === "restore" ? "primary" : "destructive"}
        pending={lifecyclePending}
        onConfirm={handleConfirmLifecycle}
        onCancel={() => setLifecycleIntent(null)}
      />
    </form>
  );
}
