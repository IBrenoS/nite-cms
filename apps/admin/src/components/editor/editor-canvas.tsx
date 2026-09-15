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
import { NodeViewContextProvider } from "./node-view-context";
import type { EditorialFieldErrors } from "@/lib/editorial-form";

type EditorCanvasProps = {
  title: string;
  summary: string;
  fieldErrors: EditorialFieldErrors;
  editor: Editor | null;
  inlinePanelOpen: boolean;
  inlineMediaState: "idle" | "uploading" | "processing" | "ready" | "error";
  inlineMediaMessage?: string;
  inlineAlt: string;
  inlineCaption: string;
  inlineCredit: string;
  inlineLayout: "normal" | "wide" | "full";
  inlineAltError?: string;
  videoPanelOpen: boolean;
  videoState: VideoUploadState;
  videoProgress: number;
  videoMessage?: string;
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
  videoReplacementPending: boolean;
  videoReplacementMessage?: string;
  wordCount: number;
  isDirty: boolean;
  onTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
  onToggleInlinePanel: () => void;
  onInlineAltChange: (value: string) => void;
  onInlineCaptionChange: (value: string) => void;
  onInlineCreditChange: (value: string) => void;
  onInlineLayoutChange: (value: "normal" | "wide" | "full") => void;
  onInlineFileSelect: (file: File) => void;
  onInsertInlineImage: () => void;
  onToggleVideoPanel: () => void;
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
  onReplaceSelectedVideo: (file: File) => void;
  onReplaceSelectedCaptions: (file: File) => void;
};

export function EditorCanvas({
  title,
  summary,
  fieldErrors,
  editor,
  inlinePanelOpen,
  inlineMediaState,
  inlineMediaMessage,
  inlineAlt,
  inlineCaption,
  inlineCredit,
  inlineLayout,
  inlineAltError,
  videoPanelOpen,
  videoState,
  videoProgress,
  videoMessage,
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
  videoReplacementPending,
  videoReplacementMessage,
  wordCount,
  isDirty,
  onTitleChange,
  onSummaryChange,
  onToggleInlinePanel,
  onInlineAltChange,
  onInlineCaptionChange,
  onInlineCreditChange,
  onInlineLayoutChange,
  onInlineFileSelect,
  onInsertInlineImage,
  onToggleVideoPanel,
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
  onReplaceSelectedVideo,
  onReplaceSelectedCaptions,
}: EditorCanvasProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = `${Math.max(38, titleRef.current.scrollHeight)}px`;
    }
  }, [title]);

  const isEditorEmpty = !editor || editor.isEmpty;

  return (
    <div className="space-y-4">
      {/* Integrated Editorial Surface: Title, Summary, Toolbar & Body */}
      <section
        className="editor-surface overflow-hidden rounded-xl border border-nite-border-subtle bg-nite-surface shadow-xs"
        aria-labelledby="body-title"
      >
        {/* Title & Summary Section */}
        <div className="border-b border-nite-border-subtle p-4 sm:p-5">
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
            className="min-h-[2.5rem] resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 font-editorial text-[clamp(1.75rem,4vw,2.375rem)] leading-tight font-semibold tracking-tight shadow-none placeholder:text-nite-text-secondary/50 focus-visible:ring-0"
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <div className="mt-1 flex items-start justify-between gap-4 text-xs text-nite-text-secondary">
            {fieldErrors.title ? (
              <p id="title-error" className="text-xs text-status-error">
                {fieldErrors.title[0]}
              </p>
            ) : (
              <span className="text-nite-text-muted">
                Título editorial principal.
              </span>
            )}
            <span className="ml-auto font-mono text-[11px] text-nite-text-muted">
              {title.length}/100
            </span>
          </div>

          <div className="my-3 border-t border-nite-border-subtle/60" />

          <div>
            <label
              htmlFor="summary"
              className="mb-1 block text-xs font-semibold text-nite-text-primary"
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
              aria-describedby={
                fieldErrors.summary ? "summary-error" : undefined
              }
              value={summary}
              placeholder="Linha fina ou resumo que introduz a matéria para o leitor."
              className="min-h-16 resize-none rounded-md px-3 py-2 text-xs leading-5"
              onChange={(event) => onSummaryChange(event.target.value)}
            />
            <div className="mt-1 flex items-start justify-between gap-4 text-xs text-nite-text-secondary">
              {fieldErrors.summary ? (
                <span id="summary-error" className="text-xs text-status-error">
                  {fieldErrors.summary[0]}
                </span>
              ) : (
                <span className="text-[11px] text-nite-text-muted">
                  Utilizado na listagem e cards do Portal.
                </span>
              )}
              <span className="font-mono text-[11px] text-nite-text-muted">
                {summary.length}/220
              </span>
            </div>
          </div>
        </div>

        {/* Header bar of the editor content */}
        <div className="flex items-center justify-between border-b border-nite-border-subtle px-4 py-2">
          <h2
            id="body-title"
            className="text-xs font-semibold text-nite-text-primary"
          >
            Conteúdo
          </h2>
          <span className="text-[11px] text-nite-text-secondary">
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
          <EditorInlineImagePanel
            inlineMediaState={inlineMediaState}
            inlineMediaMessage={inlineMediaMessage}
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
          />
        ) : null}

        {videoPanelOpen ? (
          <EditorInlineVideoPanel
            videoState={videoState}
            videoProgress={videoProgress}
            videoMessage={videoMessage}
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
          />
        ) : null}

        {/* Content Body with in-place NodeViews and contextual media context */}
        <NodeViewContextProvider
          value={{
            onReplaceVideo: onReplaceSelectedVideo,
            onReplaceCaptions: onReplaceSelectedCaptions,
            videoReplacementPending,
            videoReplacementMessage,
          }}
        >
          <div
            data-editorial-field="body"
            tabIndex={fieldErrors.body ? -1 : undefined}
            aria-invalid={Boolean(fieldErrors.body)}
            aria-describedby={fieldErrors.body ? "body-error" : undefined}
            className="relative min-h-[clamp(15rem,28vh,18rem)]"
          >
            {isEditorEmpty ? (
              <p className="pointer-events-none absolute left-5 top-5 sm:left-7 sm:top-6 font-editorial text-lg text-nite-text-muted/60 select-none">
                Comece a escrever a matéria…
              </p>
            ) : null}

            <EditorContent
              editor={editor}
              className="px-5 py-5 sm:px-7 sm:py-6"
            />
          </div>
        </NodeViewContextProvider>

        {fieldErrors.body ? (
          <p
            id="body-error"
            className="border-t border-nite-border-subtle px-4 py-2.5 text-xs text-status-error"
          >
            {fieldErrors.body[0]}
          </p>
        ) : null}

        <div className="flex items-center justify-between border-t border-nite-border-subtle bg-nite-section/20 px-4 py-2 text-[11px] text-nite-text-secondary">
          <span className="font-mono">
            {wordCount} {wordCount === 1 ? "palavra" : "palavras"}
          </span>
          <span>{isDirty ? "Alterações não salvas" : "Revisão salva"}</span>
        </div>
      </section>
    </div>
  );
}
