"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { isAllowedEditorialLink } from "@nite/editorial";
import {
  BoldIcon,
  Button,
  Heading2Icon,
  Heading3Icon,
  ImagePlusIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
} from "@nite/cms-ui";

type EditorToolbarProps = {
  editor: Editor | null;
  inlinePanelOpen: boolean;
  videoPanelOpen: boolean;
  onToggleInlinePanel: () => void;
  onToggleVideoPanel: () => void;
};

export function EditorToolbar({
  editor,
  inlinePanelOpen,
  videoPanelOpen,
  onToggleInlinePanel,
  onToggleVideoPanel,
}: EditorToolbarProps) {
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkError, setLinkError] = useState<string>();

  function openLinkPanel() {
    const href = editor?.getAttributes("link").href;
    setLinkHref(typeof href === "string" ? href : "");
    setLinkError(undefined);
    setLinkPanelOpen((open) => !open);
  }

  function applyLink() {
    const href = linkHref.trim();
    if (!href || !isAllowedEditorialLink(href)) {
      setLinkError("Use http, https, mailto ou um caminho interno.");
      return;
    }
    editor?.chain().focus().setLink({ href }).run();
    setLinkPanelOpen(false);
  }

  function removeLink() {
    editor?.chain().focus().unsetLink().run();
    setLinkHref("");
    setLinkError(undefined);
    setLinkPanelOpen(false);
  }

  return (
    <div className="border-b border-nite-border-subtle bg-nite-section/50">
      <div
        className="flex flex-wrap items-center gap-1 px-3 py-2"
        role="toolbar"
        aria-label="Formatação do texto"
      >
        <button
          type="button"
          aria-label="Desfazer (Ctrl+Z)"
          title="Desfazer · Ctrl+Z"
          disabled={!editor}
          onClick={() => editor?.chain().focus().undo().run()}
          className="inline-flex size-8 items-center justify-center rounded text-xs text-nite-text-secondary hover:bg-nite-surface disabled:opacity-40"
        >
          ↶
        </button>
        <button
          type="button"
          aria-label="Refazer (Ctrl+Shift+Z)"
          title="Refazer · Ctrl+Shift+Z"
          disabled={!editor}
          onClick={() => editor?.chain().focus().redo().run()}
          className="inline-flex size-8 items-center justify-center rounded text-xs text-nite-text-secondary hover:bg-nite-surface disabled:opacity-40"
        >
          ↷
        </button>
        <button
          type="button"
          aria-label="Parágrafo"
          aria-pressed={editor?.isActive("paragraph") ?? false}
          onClick={() => editor?.chain().focus().setParagraph().run()}
          className={`inline-flex min-h-8 items-center justify-center rounded px-2.5 text-xs font-semibold transition-colors ${
            editor?.isActive("paragraph")
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          Parágrafo
        </button>

        <button
          type="button"
          aria-label="Intertítulo (H2)"
          aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            editor?.isActive("heading", { level: 2 })
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          <Heading2Icon className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Subseção (H3)"
          aria-pressed={editor?.isActive("heading", { level: 3 }) ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            editor?.isActive("heading", { level: 3 })
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          <Heading3Icon className="size-4" aria-hidden="true" />
        </button>

        <span
          className="mx-1 h-4 w-px bg-nite-border-subtle"
          aria-hidden="true"
        />

        <button
          type="button"
          aria-label="Negrito"
          aria-pressed={editor?.isActive("bold") ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            editor?.isActive("bold")
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          <BoldIcon className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Itálico"
          aria-pressed={editor?.isActive("italic") ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            editor?.isActive("italic")
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          <ItalicIcon className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Link"
          aria-pressed={editor?.isActive("link") ?? false}
          aria-expanded={linkPanelOpen}
          onClick={openLinkPanel}
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            editor?.isActive("link")
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          <LinkIcon className="size-4" aria-hidden="true" />
        </button>

        <span
          className="mx-1 h-4 w-px bg-nite-border-subtle"
          aria-hidden="true"
        />

        <button
          type="button"
          aria-label="Lista"
          aria-pressed={editor?.isActive("bulletList") ?? false}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            editor?.isActive("bulletList")
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          <ListIcon className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Lista numerada"
          aria-pressed={editor?.isActive("orderedList") ?? false}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            editor?.isActive("orderedList")
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          <ListOrderedIcon className="size-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Citação"
          aria-pressed={editor?.isActive("blockquote") ?? false}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
            editor?.isActive("blockquote")
              ? "bg-nite-surface text-nite-brand-primary shadow-xs"
              : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
          }`}
        >
          <QuoteIcon className="size-4" aria-hidden="true" />
        </button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Inserir imagem no conteúdo"
          aria-expanded={inlinePanelOpen}
          className="ml-auto text-xs text-nite-brand-primary hover:bg-nite-surface"
          onClick={onToggleInlinePanel}
        >
          <ImagePlusIcon aria-hidden="true" />
          <span className="hidden sm:inline">Inserir imagem</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Inserir vídeo no conteúdo"
          aria-expanded={videoPanelOpen}
          className="text-xs text-nite-brand-primary hover:bg-nite-surface"
          onClick={onToggleVideoPanel}
        >
          <span aria-hidden="true">▶</span>
          <span className="hidden sm:inline">Inserir vídeo</span>
        </Button>
      </div>
      {linkPanelOpen ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-nite-border-subtle p-3">
          <label className="min-w-56 flex-1 text-xs font-semibold text-nite-text-primary">
            URL do link
            <input
              value={linkHref}
              aria-invalid={Boolean(linkError)}
              aria-describedby={linkError ? "editor-link-error" : undefined}
              onChange={(event) => {
                setLinkHref(event.target.value);
                setLinkError(undefined);
              }}
              placeholder="https://… ou /caminho"
              className="nite-form-field mt-1 min-h-8 w-full rounded-md border px-2 text-xs"
            />
          </label>
          <button
            type="button"
            onClick={applyLink}
            className="min-h-8 rounded-md bg-nite-brand-primary px-3 text-xs font-semibold text-white"
          >
            Aplicar link
          </button>
          <button
            type="button"
            onClick={removeLink}
            className="min-h-8 rounded-md px-3 text-xs font-semibold text-status-error hover:bg-status-error/10"
          >
            Remover link
          </button>
          {linkError ? (
            <p
              id="editor-link-error"
              role="alert"
              className="w-full text-xs text-status-error"
            >
              {linkError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
