"use client";

import type { Editor } from "@tiptap/react";
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
  onToggleInlinePanel: () => void;
  onToggleLink: () => void;
};

export function EditorToolbar({
  editor,
  inlinePanelOpen,
  onToggleInlinePanel,
  onToggleLink,
}: EditorToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-nite-border-subtle bg-nite-section/50 px-3 py-2"
      role="toolbar"
      aria-label="Formatação do texto"
    >
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
        aria-label="Subtítulo"
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
        aria-label="Seção"
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
        onClick={onToggleLink}
        className={`inline-flex size-8 items-center justify-center rounded transition-colors ${
          editor?.isActive("link")
            ? "bg-nite-surface text-nite-brand-primary shadow-xs"
            : "text-nite-text-secondary hover:bg-nite-surface hover:text-nite-text-primary"
        }`}
      >
        <LinkIcon className="size-4" aria-hidden="true" />
      </button>

      {editor?.isActive("link") ? (
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="inline-flex min-h-8 items-center rounded px-2 text-xs text-status-error hover:bg-status-error/10"
        >
          Remover link
        </button>
      ) : null}

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
    </div>
  );
}
