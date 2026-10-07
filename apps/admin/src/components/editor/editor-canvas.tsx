"use client";

import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { Textarea } from "@nite/cms-ui";
import { EditorToolbar } from "./editor-toolbar";
import { EditorInlineImagePanel } from "./editor-inline-image-panel";
import {
  EditorInlineVideoPanel,
  type VideoUploadState,
} from "./editor-inline-video-panel";
import {
  NodeViewContextProvider,
  type EditorMediaMap,
} from "./node-view-context";
import type { EditorialFieldErrors } from "@/lib/editorial-form";

type EditorCanvasProps = {
  title: string;
  summary: string;
  fieldErrors: EditorialFieldErrors;
  editor: Editor | null;
  mediaById: EditorMediaMap;
  inlinePanelOpen: boolean;
  inlineMediaState: "idle" | "uploading" | "processing" | "ready" | "error";
  inlineMediaProgress: number;
  inlineMediaMessage?: string;
  inlinePreviewUrl?: string;
  inlineAlt: string;
  inlineCaption: string;
  inlineCredit: string;
  inlineLayout: "normal" | "wide" | "full";
  inlineAltError?: string;
  videoPanelOpen: boolean;
  videoState: VideoUploadState;
  videoProgress: number;
  videoMessage?: string;
  videoPreviewUrl?: string;
  captionsState: VideoUploadState;
  captionsProgress: number;
  captionsMessage?: string;
  videoPlaybackMode: "autoplay" | "manual";
  videoDescription: string;
  videoCaption: string;
  videoCredit: string;
  videoLayout: "normal" | "wide" | "full";
  videoDurationMs?: number;
  videoHasAudio?: boolean;
  mediaReplacementPending: boolean;
  mediaReplacementMessage?: string;
  wordCount: number;
  isDirty: boolean;
  onTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onToggleInlinePanel: () => void;
  onCancelInlinePanel: () => void;
  onInlineAltChange: (value: string) => void;
  onInlineCaptionChange: (value: string) => void;
  onInlineCreditChange: (value: string) => void;
  onInlineLayoutChange: (value: "normal" | "wide" | "full") => void;
  onInlineFileSelect: (file: File) => void;
  onInsertInlineImage: () => void;
  onRetryInlineImage: () => void;
  onToggleVideoPanel: () => void;
  onCloseVideoPanel: () => void;
  onVideoFileSelect: (file: File) => void;
  onCaptionsFileSelect: (file: File) => void;
  onCancelVideo: () => void;
  onCancelCaptions: () => void;
  onRetryVideo: () => void;
  onRetryCaptions: () => void;
  onVideoPlaybackModeChange: (value: "autoplay" | "manual") => void;
  onVideoDescriptionChange: (value: string) => void;
  onVideoCaptionChange: (value: string) => void;
  onVideoCreditChange: (value: string) => void;
  onVideoLayoutChange: (value: "normal" | "wide" | "full") => void;
  onInsertVideo: () => void;
  onReplaceSelectedImage: (file: File) => void;
  onReplaceSelectedVideo: (file: File) => void;
  onReplaceSelectedCaptions: (file: File) => void;
};

export function EditorCanvas({
  title,
  summary,
  fieldErrors,
  editor,
  mediaById,
  inlinePanelOpen,
  inlineMediaState,
  inlineMediaProgress,
  inlineMediaMessage,
  inlinePreviewUrl,
  inlineAlt,
  inlineCaption,
  inlineCredit,
  inlineLayout,
  inlineAltError,
  videoPanelOpen,
  videoState,
  videoProgress,
  videoMessage,
  videoPreviewUrl,
  captionsState,
  captionsProgress,
  captionsMessage,
  videoPlaybackMode,
  videoDescription,
  videoCaption,
  videoCredit,
  videoLayout,
  videoDurationMs,
  videoHasAudio,
  mediaReplacementPending,
  mediaReplacementMessage,
  wordCount,
  isDirty,
  onTitleChange,
  onSummaryChange,
  onToggleInlinePanel,
  onCancelInlinePanel,
  onInlineAltChange,
  onInlineCaptionChange,
  onInlineCreditChange,
  onInlineLayoutChange,
  onInlineFileSelect,
  onInsertInlineImage,
  onRetryInlineImage,
  onToggleVideoPanel,
  onCloseVideoPanel,
  onVideoFileSelect,
  onCaptionsFileSelect,
  onCancelVideo,
  onCancelCaptions,
  onRetryVideo,
  onRetryCaptions,
  onVideoPlaybackModeChange,
  onVideoDescriptionChange,
  onVideoCaptionChange,
  onVideoCreditChange,
  onVideoLayoutChange,
  onInsertVideo,
  onReplaceSelectedImage,
  onReplaceSelectedVideo,
  onReplaceSelectedCaptions,
}: EditorCanvasProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const mediaInsertPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const resizeTitle = () => {
      if (!titleRef.current) return;
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = `${Math.max(44, titleRef.current.scrollHeight + 4)}px`;
    };

    resizeTitle();
    window.addEventListener("resize", resizeTitle);
    return () => window.removeEventListener("resize", resizeTitle);
  }, [title]);

  useEffect(() => {
    if (!inlinePanelOpen && !videoPanelOpen) return;
    const panel = mediaInsertPanelRef.current;
    if (!panel || typeof panel.scrollIntoView !== "function") return;

    panel.scrollIntoView({ block: "center", behavior: "auto" });
  }, [inlinePanelOpen, videoPanelOpen]);

  const isEditorEmpty = !editor || editor.isEmpty;

  return (
    <section
      className="editor-surface min-h-full bg-surface"
      aria-labelledby="body-title"
    >
      <div className="mx-auto w-full max-w-[760px] px-5 pt-8 pb-6 sm:px-8 sm:pt-10">
        <label htmlFor="title" className="sr-only">
          Título
        </label>
        <Textarea
          ref={titleRef}
          id="title"
          name="title"
          rows={1}
          maxLength={100}
          data-editorial-field="title"
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? "title-error" : undefined}
          value={title}
          placeholder="Título da matéria"
          className="min-h-11 resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 font-editorial text-editor-title font-semibold tracking-tight shadow-none placeholder:text-text-muted focus-visible:ring-0"
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <div className="mt-2 flex items-start justify-between gap-4 text-ui-sm text-text-secondary">
          {fieldErrors.title ? (
            <p id="title-error" className="text-danger">
              {fieldErrors.title[0]}
            </p>
          ) : (
            <span>Título editorial principal.</span>
          )}
          <span className="ml-auto font-mono text-ui-xs text-text-muted">
            {title.length}/100
          </span>
        </div>

        <div className="mt-5">
          <label
            htmlFor="summary"
            className="mb-1 block text-ui-md font-semibold text-text-primary"
          >
            Resumo
          </label>
          <Textarea
            id="summary"
            name="summary"
            rows={2}
            maxLength={220}
            data-editorial-field="summary"
            aria-invalid={Boolean(fieldErrors.summary)}
            aria-describedby={fieldErrors.summary ? "summary-error" : undefined}
            value={summary}
            placeholder="Linha fina ou resumo que introduz a matéria para o leitor."
            className="min-h-20 max-h-44 resize-none rounded-none border-x-0 border-t-0 bg-transparent px-0 py-2 font-editorial text-editor-summary shadow-none [field-sizing:content] focus-visible:ring-0"
            onChange={(event) => onSummaryChange(event.target.value)}
          />
          <div className="mt-1 flex items-start justify-between gap-4 text-ui-sm text-text-secondary">
            {fieldErrors.summary ? (
              <span id="summary-error" className="text-danger">
                {fieldErrors.summary[0]}
              </span>
            ) : (
              <span>Utilizado na listagem e nos cards do Portal.</span>
            )}
            <span className="font-mono text-ui-xs text-text-muted">
              {summary.length}/220
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[760px] items-center justify-between border-t border-border-subtle px-5 py-2.5 sm:px-8">
        <h2
          id="body-title"
          className="text-ui-md font-semibold text-text-primary"
        >
          Conteúdo
        </h2>
        <span className="hidden text-ui-sm text-text-secondary sm:inline">
          Tempo de leitura calculado ao salvar
        </span>
      </div>

      <EditorToolbar
        editor={editor}
        inlinePanelOpen={inlinePanelOpen}
        videoPanelOpen={videoPanelOpen}
        onToggleInlinePanel={onToggleInlinePanel}
        onToggleVideoPanel={onToggleVideoPanel}
      />

      {inlinePanelOpen ? (
        <div ref={mediaInsertPanelRef} data-media-insert-panel="image">
          <EditorInlineImagePanel
            inlineMediaState={inlineMediaState}
            inlineMediaProgress={inlineMediaProgress}
            inlineMediaMessage={inlineMediaMessage}
            previewUrl={inlinePreviewUrl}
            inlineAlt={inlineAlt}
            inlineCaption={inlineCaption}
            inlineCredit={inlineCredit}
            inlineLayout={inlineLayout}
            inlineAltError={inlineAltError}
            onAltChange={onInlineAltChange}
            onCaptionChange={onInlineCaptionChange}
            onCreditChange={onInlineCreditChange}
            onLayoutChange={onInlineLayoutChange}
            onFileSelect={onInlineFileSelect}
            onInsert={onInsertInlineImage}
            onRetry={onRetryInlineImage}
            onCancel={onCancelInlinePanel}
          />
        </div>
      ) : null}

      {videoPanelOpen ? (
        <div ref={mediaInsertPanelRef} data-media-insert-panel="video">
          <EditorInlineVideoPanel
            videoState={videoState}
            videoProgress={videoProgress}
            videoMessage={videoMessage}
            videoPreviewUrl={videoPreviewUrl}
            captionsState={captionsState}
            captionsProgress={captionsProgress}
            captionsMessage={captionsMessage}
            playbackMode={videoPlaybackMode}
            description={videoDescription}
            caption={videoCaption}
            credit={videoCredit}
            layout={videoLayout}
            durationMs={videoDurationMs}
            hasAudio={videoHasAudio}
            onVideoFileSelect={onVideoFileSelect}
            onCaptionsFileSelect={onCaptionsFileSelect}
            onCancelVideo={onCancelVideo}
            onCancelCaptions={onCancelCaptions}
            onRetryVideo={onRetryVideo}
            onRetryCaptions={onRetryCaptions}
            onPlaybackModeChange={onVideoPlaybackModeChange}
            onDescriptionChange={onVideoDescriptionChange}
            onCaptionChange={onVideoCaptionChange}
            onCreditChange={onVideoCreditChange}
            onLayoutChange={onVideoLayoutChange}
            onInsert={onInsertVideo}
            onClosePanel={onCloseVideoPanel}
          />
        </div>
      ) : null}

      <NodeViewContextProvider
        value={{
          mediaById,
          onReplaceImage: onReplaceSelectedImage,
          onReplaceVideo: onReplaceSelectedVideo,
          onReplaceCaptions: onReplaceSelectedCaptions,
          mediaReplacementPending,
          mediaReplacementMessage,
        }}
      >
        <div
          data-editorial-field="body"
          tabIndex={fieldErrors.body ? -1 : undefined}
          aria-invalid={Boolean(fieldErrors.body)}
          aria-describedby={fieldErrors.body ? "body-error" : undefined}
          className="relative mx-auto min-h-[clamp(24rem,52vh,44rem)] w-full max-w-[760px]"
        >
          {isEditorEmpty ? (
            <p className="pointer-events-none absolute top-7 left-5 font-editorial text-editor-body text-text-muted/70 select-none sm:left-8">
              Comece a escrever a matéria…
            </p>
          ) : null}

          <EditorContent
            editor={editor}
            className="mx-auto max-w-[72ch] px-5 py-7 sm:px-8"
          />
        </div>
      </NodeViewContextProvider>

      {fieldErrors.body ? (
        <p
          id="body-error"
          className="mx-auto w-full max-w-[760px] border-t border-border-subtle px-5 py-2.5 text-ui-sm text-danger sm:px-8"
        >
          {fieldErrors.body[0]}
        </p>
      ) : null}

      <div className="mx-auto flex w-full max-w-[760px] items-center justify-between border-t border-border-subtle bg-surface-subtle/50 px-5 py-2.5 text-ui-sm text-text-secondary sm:px-8">
        <span className="font-mono">
          {wordCount} {wordCount === 1 ? "palavra" : "palavras"}
        </span>
        <span>{isDirty ? "Alterações não salvas" : "Revisão salva"}</span>
      </div>
    </section>
  );
}
