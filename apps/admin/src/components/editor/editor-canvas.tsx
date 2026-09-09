"use client";

import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { Textarea } from "@nite/cms-ui";
import { EditorToolbar } from "./editor-toolbar";
import { EditorInlineImagePanel } from "./editor-inline-image-panel";
import { EditorSelectedImagePanel } from "./editor-selected-image-panel";
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
}: EditorCanvasProps) {
  return (
    <div className="space-y-4">
      {/* Title & Summary Section */}
      <section className="overflow-hidden rounded-lg border border-nite-border-subtle bg-nite-surface">
        <div className="border-b border-nite-border-subtle p-4 sm:p-5">
          <label htmlFor="title" className="sr-only">
            Título
          </label>
          <Textarea
            id="title"
            name="title"
            rows={2}
            maxLength={100}
            data-editorial-field="title"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? "title-error" : undefined}
            value={title}
            placeholder="Título da matéria"
            className="min-h-14 resize-none rounded-none border-0 bg-transparent p-0 font-editorial text-[clamp(1.75rem,4vw,2.375rem)] leading-tight font-semibold tracking-tight shadow-none placeholder:text-nite-text-secondary/50 focus-visible:ring-0"
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <div className="mt-2 flex items-start justify-between gap-4 text-xs text-nite-text-secondary">
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
        </div>

        <div className="p-4 sm:p-5">
          <label
            htmlFor="summary"
            className="mb-1.5 block text-xs font-semibold text-nite-text-primary"
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
            className="min-h-16 resize-none rounded-md px-3 py-2 text-xs leading-5"
            onChange={(event) => onSummaryChange(event.target.value)}
          />
          <div className="mt-1.5 flex items-start justify-between gap-4 text-xs text-nite-text-secondary">
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
      </section>

      {/* Editor Surface */}
      <section
        className="editor-surface overflow-hidden rounded-lg border border-nite-border-subtle bg-nite-surface"
        aria-labelledby="body-title"
      >
        <div className="flex items-center justify-between border-b border-nite-border-subtle px-4 py-2.5">
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
          onToggleInlinePanel={onToggleInlinePanel}
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

        {editor?.isActive("image") ? (
          <EditorSelectedImagePanel
            editor={editor}
            image={{
              alt:
                typeof editor.getAttributes("image").alt === "string"
                  ? editor.getAttributes("image").alt
                  : "",
              caption:
                typeof editor.getAttributes("image").caption === "string"
                  ? editor.getAttributes("image").caption
                  : "",
              credit:
                typeof editor.getAttributes("image").credit === "string"
                  ? editor.getAttributes("image").credit
                  : "",
              layout: ["normal", "wide", "full"].includes(
                editor.getAttributes("image").layout,
              )
                ? editor.getAttributes("image").layout
                : "normal",
            }}
          />
        ) : null}

        <div
          data-editorial-field="body"
          tabIndex={fieldErrors.body ? -1 : undefined}
          aria-invalid={Boolean(fieldErrors.body)}
          aria-describedby={fieldErrors.body ? "body-error" : undefined}
        >
          <EditorContent
            editor={editor}
            className="px-5 py-5 sm:px-7 sm:py-6"
          />
        </div>

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
