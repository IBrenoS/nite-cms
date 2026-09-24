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
    const resizeTitle = () => {
      if (!titleRef.current) return;
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = `${Math.max(44, titleRef.current.scrollHeight + 4)}px`;
    };

    resizeTitle();
    window.addEventListener("resize", resizeTitle);
    return () => window.removeEventListener("resize", resizeTitle);
  }, [title]);

  const isEditorEmpty = !editor || editor.isEmpty;

  return (
    <div className="min-h-full">
      {/* Integrated Editorial Surface: Title, Summary, Toolbar & Body */}
      <section
        className="editor-surface min-h-full overflow-hidden bg-nite-surface"
        aria-labelledby="body-title"
      >
        {/* Title & Summary Section */}
        <div className="max-w-[880px] border-b border-nite-border-subtle px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
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
            className="min-h-[2.75rem] resize-none overflow-hidden rounded-none border-0 bg-transparent p-0 font-editorial text-[clamp(2rem,4vw,2.75rem)] leading-[1.08] font-semibold tracking-tight shadow-none placeholder:text-nite-text-secondary/50 focus-visible:ring-0"
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
            <span className="ml-auto font-mono text-xs text-nite-text-muted">
              {title.length}/100
            </span>
          </div>

          <div className="my-3 border-t border-nite-border-subtle/60" />

          <div>
            <label
              htmlFor="summary"
              className="mb-1.5 block text-sm font-semibold text-nite-text-primary"
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
              className="min-h-20 max-h-40 resize-none rounded-md px-3 py-2.5 text-sm leading-6 [field-sizing:content]"
              onChange={(event) => onSummaryChange(event.target.value)}
            />
            <div className="mt-1 flex items-start justify-between gap-4 text-xs text-nite-text-secondary">
              {fieldErrors.summary ? (
                <span id="summary-error" className="text-xs text-status-error">
                  {fieldErrors.summary[0]}
                </span>
              ) : (
                <span className="text-xs text-nite-text-muted">
                  Utilizado na listagem e cards do Portal.
                </span>
              )}
              <span className="font-mono text-xs text-nite-text-muted">
                {summary.length}/220
              </span>
            </div>
          </div>
        </div>

        {/* Header bar of the editor content */}
        <div className="flex max-w-[880px] items-center justify-between border-b border-nite-border-subtle px-5 py-2.5 sm:px-8 lg:px-10">
          <h2
            id="body-title"
            className="text-sm font-semibold text-nite-text-primary"
          >
            Conteúdo
          </h2>
          <span className="hidden text-xs text-nite-text-secondary sm:inline">
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
            className="relative min-h-[clamp(22rem,48vh,40rem)] max-w-[880px]"
          >
            {isEditorEmpty ? (
              <p className="pointer-events-none absolute top-6 left-5 font-editorial text-lg text-nite-text-muted/60 select-none sm:left-8 lg:left-10">
                Comece a escrever a matéria…
              </p>
            ) : null}

            <EditorContent
              editor={editor}
              className="max-w-[72ch] px-5 py-6 sm:px-8 lg:px-10"
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

        <div className="flex max-w-[880px] items-center justify-between border-t border-nite-border-subtle bg-nite-section/20 px-5 py-2.5 text-xs text-nite-text-secondary sm:px-8 lg:px-10">
          <span className="font-mono">
            {wordCount} {wordCount === 1 ? "palavra" : "palavras"}
          </span>
          <span>{isDirty ? "Alterações não salvas" : "Revisão salva"}</span>
        </div>
      </section>
    </div>
  );
}
