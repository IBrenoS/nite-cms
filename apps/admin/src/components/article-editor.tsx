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
  Button,
  IconButton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  XIcon,
} from "@nite/cms-ui";
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
import { EditorPreflightDialog } from "./editor/editor-preflight-dialog";
import type { EditorMediaMap } from "./editor/node-view-context";
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
  initialBodyMedia?: EditorMediaMap;
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

const inspectorFields = new Set<EditorialField>([
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
]);

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
  initialBodyMedia = {},
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
  const [bodyMedia, setBodyMedia] = useState<EditorMediaMap>(initialBodyMedia);
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
  const [inlineMediaProgress, setInlineMediaProgress] = useState(0);
  const [inlineMediaMessage, setInlineMediaMessage] = useState<string>();
  const [inlinePreviewUrl, setInlinePreviewUrl] = useState<string>();
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
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>();
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
  const inlineAbortRef = useRef<AbortController | null>(null);
  const videoAbortRef = useRef<AbortController | null>(null);
  const captionsAbortRef = useRef<AbortController | null>(null);
  const lastInlineFileRef = useRef<File | null>(null);
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
  const [preflightDialogOpen, setPreflightDialogOpen] = useState(false);
  const confirmedPublishRef = useRef(false);
  const lastSubmitIntentRef = useRef<"save" | "publish">("save");
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

  useEffect(() => {
    if (
      actionState.status === "validation_error" &&
      lastSubmitIntentRef.current === "publish"
    ) {
      setPreflightDialogOpen(true);
    }
  }, [actionState]);

  useEffect(
    () => () => {
      if (coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    },
    [coverPreviewUrl],
  );

  useEffect(
    () => () => {
      if (inlinePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(inlinePreviewUrl);
      }
    },
    [inlinePreviewUrl],
  );

  useEffect(
    () => () => {
      if (videoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    },
    [videoPreviewUrl],
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

  function focusEditorialField(field: EditorialField) {
    setPreflightDialogOpen(false);

    const focusTarget = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-editorial-field="${field}"]`,
      );
      if (field === "body") {
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => editor?.chain().focus().run(), 180);
        return;
      }
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => target.focus({ preventScroll: true }), 180);
      }
    };

    if (inspectorFields.has(field) && window.innerWidth < 1280) {
      setIsInspectorOpen(true);
      window.setTimeout(focusTarget, 220);
      return;
    }

    if (!inspectorFields.has(field)) setIsInspectorOpen(false);
    window.setTimeout(focusTarget);
  }

  function focusFirstInvalidField(errors: EditorialFieldErrors) {
    const firstField = editorialFocusOrder.find((field) => errors[field]);
    if (firstField) focusEditorialField(firstField);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget);
    if (submitter?.name) data.set(submitter.name, submitter.value);
    lastSubmitIntentRef.current =
      submitter?.value === "publish" ? "publish" : "save";
    try {
      parseEditorialFormData(data);
      setClientFieldErrors({});
      setDismissedServerFields({});
    } catch (error) {
      event.preventDefault();
      const nextErrors = zodFieldErrors(error);
      setClientFieldErrors(nextErrors);
      setDismissedServerFields({});
      if (submitter?.value === "publish") {
        setPreflightDialogOpen(true);
      } else {
        focusFirstInvalidField(nextErrors);
      }
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
      setCoverPreviewUrl(processed.publicUrl);
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
    lastInlineFileRef.current = file;
    inlineAbortRef.current?.abort();
    const controller = new AbortController();
    inlineAbortRef.current = controller;
    setInlineMediaMessage(undefined);
    setInlineMediaState("uploading");
    setInlineMediaProgress(0);
    setInlineAltError(undefined);
    setIsDirty(true);

    if (typeof URL.createObjectURL === "function") {
      setInlinePreviewUrl(URL.createObjectURL(file));
    }

    try {
      const processed = await uploadAndProcessMedia(
        file,
        "image",
        controller.signal,
        setInlineMediaProgress,
        () => setInlineMediaState("processing"),
      );
      if (processed.mediaKind !== "image") {
        throw new Error("A mídia processada não é uma imagem.");
      }
      setInlineMediaId(processed.id);
      setBodyMedia((current) => ({
        ...current,
        [processed.id]: {
          mediaKind: "image",
          src: processed.publicUrl,
          width: processed.width ?? undefined,
          height: processed.height ?? undefined,
        },
      }));
      setInlinePreviewUrl(processed.publicUrl);
      setInlineMediaState("ready");
      setInlineMediaProgress(100);
      setInlineMediaMessage("Imagem pronta para inserir.");
    } catch (error) {
      if (error instanceof MediaUploadCanceledError) {
        setInlineMediaState("idle");
        setInlineMediaMessage("Upload da imagem cancelado.");
      } else {
        setInlineMediaState("error");
        setInlineMediaMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível processar a imagem inline.",
        );
      }
    } finally {
      if (inlineAbortRef.current === controller) inlineAbortRef.current = null;
    }
  }

  function cancelInlineInsert() {
    inlineAbortRef.current?.abort();
    inlineAbortRef.current = null;
    lastInlineFileRef.current = null;
    setInlineMediaId("");
    setInlineAlt("");
    setInlineCaption("");
    setInlineCredit("");
    setInlineLayout("normal");
    setInlineAltError(undefined);
    setInlineMediaState("idle");
    setInlineMediaProgress(0);
    setInlineMediaMessage(undefined);
    setInlinePreviewUrl(undefined);
    setInlinePanelOpen(false);
  }

  async function retryInlineImage() {
    const file = lastInlineFileRef.current;
    if (file) await uploadInlineImage(file);
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
      .scrollIntoView()
      .run();
    setInlineMediaId("");
    setInlineAlt("");
    setInlineCaption("");
    setInlineCredit("");
    setInlineLayout("normal");
    setInlineAltError(undefined);
    setInlineMediaState("idle");
    setInlineMediaProgress(0);
    setInlineMediaMessage(undefined);
    setInlinePreviewUrl(undefined);
    setInlinePanelOpen(false);
    lastInlineFileRef.current = null;
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
    setIsDirty(true);
    if (typeof URL.createObjectURL === "function") {
      setVideoPreviewUrl(URL.createObjectURL(file));
    }
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
      setBodyMedia((current) => ({
        ...current,
        [processed.id]: {
          mediaKind: "video",
          src: processed.publicUrl,
          width: processed.width ?? undefined,
          height: processed.height ?? undefined,
          durationSeconds:
            processed.durationMs != null
              ? processed.durationMs / 1000
              : undefined,
        },
      }));
      setVideoPreviewUrl(processed.publicUrl);
      setVideoDurationMs(processed.durationMs ?? undefined);
      setVideoHasAudio(processed.hasAudio ?? undefined);
      setVideoState("ready");
      setVideoProgress(100);
      setVideoMessage("Vídeo pronto para inserir.");
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
      setBodyMedia((current) => ({
        ...current,
        [processed.id]: {
          mediaKind: "captions",
          src: processed.publicUrl,
        },
      }));
      setCaptionsState("ready");
      setCaptionsProgress(100);
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
      .scrollIntoView()
      .run();
    setVideoMediaId("");
    setCaptionsMediaId("");
    setVideoState("idle");
    setCaptionsState("idle");
    setVideoProgress(0);
    setCaptionsProgress(0);
    setVideoMessage(undefined);
    setCaptionsMessage(undefined);
    setVideoPreviewUrl(undefined);
    lastVideoFileRef.current = null;
    lastCaptionsFileRef.current = null;
    setVideoDescription("");
    setVideoCaption("");
    setVideoCredit("");
    setVideoLayout("normal");
    setVideoDurationMs(undefined);
    setVideoHasAudio(undefined);
    setVideoPanelOpen(false);
    setIsDirty(true);
  }

  function closeVideoPanel() {
    videoAbortRef.current?.abort();
    captionsAbortRef.current?.abort();
    videoAbortRef.current = null;
    captionsAbortRef.current = null;
    lastVideoFileRef.current = null;
    lastCaptionsFileRef.current = null;
    setVideoMediaId("");
    setCaptionsMediaId("");
    setVideoState("idle");
    setCaptionsState("idle");
    setVideoProgress(0);
    setCaptionsProgress(0);
    setVideoMessage(undefined);
    setCaptionsMessage(undefined);
    setVideoPreviewUrl(undefined);
    setVideoDescription("");
    setVideoCaption("");
    setVideoCredit("");
    setVideoLayout("normal");
    setVideoDurationMs(undefined);
    setVideoHasAudio(undefined);
    setVideoPanelOpen(false);
  }

  async function replaceSelectedImage(file: File) {
    if (!editor?.isActive("image")) return;
    setVideoReplacementPending(true);
    setVideoReplacementMessage("Substituindo imagem…");
    try {
      const processed = await uploadAndProcessMedia(file, "image");
      if (processed.mediaKind !== "image") {
        throw new Error("Mídia incompatível.");
      }
      setBodyMedia((current) => ({
        ...current,
        [processed.id]: {
          mediaKind: "image",
          src: processed.publicUrl,
          width: processed.width ?? undefined,
          height: processed.height ?? undefined,
        },
      }));
      editor
        .chain()
        .focus()
        .updateAttributes("image", { mediaId: processed.id })
        .run();
      setVideoReplacementMessage("Imagem substituída.");
      setIsDirty(true);
    } catch (error) {
      setVideoReplacementMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível substituir a imagem.",
      );
    } finally {
      setVideoReplacementPending(false);
    }
  }

  async function replaceSelectedVideo(file: File) {
    if (!editor?.isActive("video")) return;
    setVideoReplacementPending(true);
    setVideoReplacementMessage("Substituindo vídeo…");
    try {
      const processed = await uploadAndProcessMedia(file, "video");
      if (processed.mediaKind !== "video")
        throw new Error("Mídia incompatível.");
      setBodyMedia((current) => ({
        ...current,
        [processed.id]: {
          mediaKind: "video",
          src: processed.publicUrl,
          width: processed.width ?? undefined,
          height: processed.height ?? undefined,
          durationSeconds:
            processed.durationMs != null
              ? processed.durationMs / 1000
              : undefined,
        },
      }));
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
      setBodyMedia((current) => ({
        ...current,
        [processed.id]: {
          mediaKind: "captions",
          src: processed.publicUrl,
        },
      }));
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

  async function openLivePreview() {
    if (!initial) return;
    const form = document.getElementById("article-editor-form");
    if (!(form instanceof HTMLFormElement)) return;
    setPreviewPending(true);
    setPreviewMessage(undefined);
    try {
      const data = new FormData(form);
      data.set("intent", "save");
      const result = await createLivePreviewLink(data);
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
      target: "title" as const,
    },
    {
      label: "Conteúdo da matéria",
      complete: bodyText.length > 0,
      target: "body" as const,
    },
    {
      label: "Categoria e assinatura",
      complete: category !== "" && byline.trim().length >= 3,
      target: "category" as const,
    },
    {
      label: "Capa e texto alternativo",
      complete:
        mediaState === "ready" &&
        mediaId.length > 0 &&
        coverAlt.trim().length >= 12,
      target: "coverMedia" as const,
    },
  ];
  const readyForFinalReview =
    preparationItems.slice(1).every((item) => item.complete) &&
    slug.length >= 3 &&
    seoReady;
  const completePreparationItems = [
    ...preparationItems,
    {
      label: "Revisão final",
      complete: readyForFinalReview,
      target: "slug" as const,
    },
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
    onNavigateToField: focusEditorialField,
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
      className="flex min-h-[calc(100dvh-56px)] flex-col inspector-rail:h-dvh inspector-rail:min-h-0 inspector-rail:overflow-hidden"
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
        openLivePreview={() => void openLivePreview()}
      />

      {/* Faixa de Notificações / Status Banner com aria-live="polite" */}
      {previewMessage ? (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 border-b border-warning-border bg-warning-bg px-4 py-2 text-ui-sm text-text-primary sm:px-6 lg:px-8"
        >
          <span>{previewMessage}</span>
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPreviewMessage(undefined)}
            aria-label="Fechar aviso"
            className="max-sm:size-11"
          >
            <XIcon aria-hidden="true" />
          </IconButton>
        </div>
      ) : null}

      {Object.keys(fieldErrors).length > 0 ? (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between gap-3 border-b border-danger-border bg-danger-bg px-4 py-2 text-ui-sm text-danger sm:px-6 lg:px-8"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Revise os campos destacados.</span>
            <span className="hidden text-danger/80 sm:inline">
              Existem dados pendentes que impedem a publicação.
            </span>
          </div>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => focusFirstInvalidField(fieldErrors)}
            className="shrink-0 text-danger"
          >
            Ir para o primeiro campo
          </Button>
        </div>
      ) : null}

      {lifecycleMessage ? (
        <div
          role={lifecycleError ? "alert" : "status"}
          aria-live="polite"
          className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-ui-sm sm:px-6 lg:px-8 ${
            lifecycleError
              ? "border-danger-border bg-danger-bg text-danger"
              : "border-success-border bg-success-bg text-success"
          }`}
        >
          <span>{lifecycleMessage}</span>
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLifecycleMessage(undefined)}
            aria-label="Fechar aviso"
            className="max-sm:size-11"
          >
            <XIcon aria-hidden="true" />
          </IconButton>
        </div>
      ) : null}

      {actionMessage &&
      actionState.status !== "idle" &&
      actionState.status !== "validation_error" ? (
        <div
          role={actionState.status !== "success" ? "alert" : "status"}
          aria-live="polite"
          className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-ui-sm sm:px-6 lg:px-8 ${
            actionState.status !== "success"
              ? "border-danger-border bg-danger-bg text-danger"
              : "border-success-border bg-success-bg text-success"
          }`}
        >
          <span>{actionMessage}</span>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col inspector-rail:grid inspector-rail:min-h-0 inspector-rail:grid-cols-[minmax(0,1fr)_360px] inspector-rail:overflow-hidden">
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

        {/* Continuous editorial surface; only the reading measure is constrained. */}
        <div className="min-w-0 flex-1 bg-nite-surface inspector-rail:min-h-0 inspector-rail:overflow-y-auto inspector-rail:border-r inspector-rail:border-nite-border-subtle">
          <div className="min-h-full">
            <EditorCanvas
              title={title}
              summary={summary}
              fieldErrors={fieldErrors}
              editor={editor}
              mediaById={bodyMedia}
              inlinePanelOpen={inlinePanelOpen}
              inlineMediaProgress={inlineMediaProgress}
              inlinePreviewUrl={inlinePreviewUrl}
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
              videoPreviewUrl={videoPreviewUrl}
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
              mediaReplacementPending={videoReplacementPending}
              mediaReplacementMessage={videoReplacementMessage}
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
                setInlinePanelOpen(true);
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
              onRetryInlineImage={() => void retryInlineImage()}
              onCancelInlinePanel={cancelInlineInsert}
              onToggleVideoPanel={() => {
                setVideoPanelOpen(true);
                setInlinePanelOpen(false);
              }}
              onCloseVideoPanel={closeVideoPanel}
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
              onReplaceSelectedImage={(file) => void replaceSelectedImage(file)}
              onReplaceSelectedVideo={(file) => void replaceSelectedVideo(file)}
              onReplaceSelectedCaptions={(file) =>
                void replaceSelectedCaptions(file)
              }
            />
          </div>
        </div>

        {/* Adjacent inspector rail with independent scroll. */}
        <div className="hidden bg-nite-surface p-5 inspector-rail:h-full inspector-rail:min-h-0 inspector-rail:block inspector-rail:overflow-hidden">
          <EditorInspector mode="rail" {...commonInspectorProps} />
        </div>
      </div>

      {/* Sticky Bottom Bar for screens < 1280px */}
      <div className="sticky bottom-0 z-30 flex items-center justify-between gap-1.5 border-t border-nite-border-subtle bg-nite-surface/95 px-2 py-2 backdrop-blur inspector-rail:hidden">
        <div className="hidden items-center gap-2 text-ui-md sm:flex">
          <span className="font-semibold text-nite-text-primary">
            Preparação {preparationCount}/6
          </span>
          {Object.keys(fieldErrors).length > 0 ? (
            <span className="rounded-sm bg-danger-bg px-2 py-0.5 text-ui-xs font-semibold text-danger">
              {Object.keys(fieldErrors).length}{" "}
              {Object.keys(fieldErrors).length === 1
                ? "pendência"
                : "pendências"}
            </span>
          ) : readyForFinalReview ? (
            <span className="rounded-sm bg-success-bg px-2 py-0.5 text-ui-xs font-semibold text-success">
              Pronta
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
          <Button
            type="submit"
            name="intent"
            value="save"
            variant="secondary"
            size="lg"
            aria-label="Salvar pelo dock móvel"
            loading={pending}
            disabled={operationPending}
            className="min-h-11 flex-1 px-2 sm:hidden"
          >
            Salvar
          </Button>
          {isExisting ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={operationPending}
              onClick={() => void openLivePreview()}
              className="min-h-11 px-2 sm:hidden"
            >
              Preview
            </Button>
          ) : null}
          <Button
            ref={inspectorTriggerRef}
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setIsInspectorOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isInspectorOpen}
            aria-label="Configurações"
            className="min-h-11 px-2 sm:min-h-10 sm:px-3"
          >
            <span className="sm:hidden">Ajustes</span>
            <span className="hidden sm:inline">Configurações</span>
          </Button>
          {canPublish ? (
            <Button
              type="submit"
              name="intent"
              value="publish"
              variant="primary"
              size="lg"
              aria-label="Publicar pelo dock móvel"
              disabled={operationPending || currentStatus === "archived"}
              className="min-h-11 px-2 sm:hidden"
            >
              Publicar
            </Button>
          ) : null}
        </div>
      </div>

      {/* Responsive Inspector Overlay: Drawer (tablet) or Sheet (mobile) */}
      <Sheet
        open={isInspectorOpen}
        onOpenChange={(open) => {
          setIsInspectorOpen(open);
          if (!open) {
            requestAnimationFrame(() => inspectorTriggerRef.current?.focus());
          }
        }}
      >
        <SheetContent
          side={inspectorMode === "sheet" ? "bottom" : "right"}
          className={`gap-0 overflow-hidden p-4 sm:p-5 inspector-rail:hidden ${
            inspectorMode === "sheet"
              ? "h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)]"
              : "max-w-[400px]"
          }`}
        >
          <SheetTitle className="sr-only">Configurações da matéria</SheetTitle>
          <SheetDescription className="sr-only">
            Ajuste publicação, capa, SEO e estado editorial da matéria.
          </SheetDescription>
          <EditorInspector
            mode={inspectorMode}
            onClose={handleCloseInspector}
            {...commonInspectorProps}
          />
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <EditorPreflightDialog
        open={preflightDialogOpen}
        errors={fieldErrors}
        onNavigate={focusEditorialField}
        onOpenChange={setPreflightDialogOpen}
      />

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
