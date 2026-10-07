"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { isAllowedEditorialLink } from "@nite/editorial";
import {
  BoldIcon,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  Input,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PlusIcon,
  QuoteIcon,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
  buttonVariants,
  cn,
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
    <div className="sticky top-28 z-20 border-y border-border-subtle bg-surface/95 backdrop-blur md:top-14 inspector-rail:top-0">
      <div className="mx-auto max-w-[760px] px-5 py-2 sm:px-8">
        <Toolbar
          aria-label="Formatação do texto"
          className="flex-nowrap overflow-x-auto rounded-none border-0 bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ToolbarGroup>
            <ToolbarButton
              aria-label="Desfazer (Ctrl+Z)"
              title="Desfazer · Ctrl+Z"
              disabled={!editor}
              onClick={() => editor?.chain().focus().undo().run()}
            >
              ↶
            </ToolbarButton>
            <ToolbarButton
              aria-label="Refazer (Ctrl+Shift+Z)"
              title="Refazer · Ctrl+Shift+Z"
              disabled={!editor}
              onClick={() => editor?.chain().focus().redo().run()}
            >
              ↷
            </ToolbarButton>
            <ToolbarButton
              aria-label="Parágrafo"
              active={editor?.isActive("paragraph") ?? false}
              onClick={() => editor?.chain().focus().setParagraph().run()}
              className="px-2.5"
            >
              Parágrafo
            </ToolbarButton>
            <ToolbarButton
              aria-label="Intertítulo (H2)"
              active={editor?.isActive("heading", { level: 2 }) ?? false}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <Heading2Icon aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Subseção (H3)"
              active={editor?.isActive("heading", { level: 3 }) ?? false}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              <Heading3Icon aria-hidden="true" />
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            <ToolbarButton
              aria-label="Negrito"
              active={editor?.isActive("bold") ?? false}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <BoldIcon aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Itálico"
              active={editor?.isActive("italic") ?? false}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <ItalicIcon aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Link"
              active={editor?.isActive("link") ?? false}
              aria-expanded={linkPanelOpen}
              onClick={openLinkPanel}
            >
              <LinkIcon aria-hidden="true" />
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            <ToolbarButton
              aria-label="Lista"
              active={editor?.isActive("bulletList") ?? false}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <ListIcon aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Lista numerada"
              active={editor?.isActive("orderedList") ?? false}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrderedIcon aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Citação"
              active={editor?.isActive("blockquote") ?? false}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <QuoteIcon aria-hidden="true" />
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarSeparator className="ml-auto" />

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Inserir mídia"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                (inlinePanelOpen || videoPanelOpen) &&
                  "bg-primary-subtle text-primary",
                "h-8 shrink-0 gap-1.5 px-2.5",
              )}
            >
              <PlusIcon aria-hidden="true" />
              <span>Inserir</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={6} className="w-44">
              <DropdownMenuItem onClick={onToggleInlinePanel}>
                <ImageIcon aria-hidden="true" />
                <span>Imagem</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleVideoPanel}>
                <span aria-hidden="true">▶</span>
                <span>Vídeo</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Toolbar>
      </div>

      {linkPanelOpen ? (
        <div className="border-t border-border-subtle bg-surface px-5 py-3 sm:px-8">
          <div className="mx-auto flex max-w-[760px] flex-wrap items-end gap-2">
            <label className="min-w-56 flex-1 text-ui-md font-semibold text-text-primary">
              URL do link
              <Input
                value={linkHref}
                aria-invalid={Boolean(linkError)}
                aria-describedby={linkError ? "editor-link-error" : undefined}
                onChange={(event) => {
                  setLinkHref(event.target.value);
                  setLinkError(undefined);
                }}
                placeholder="https://… ou /caminho"
                className="mt-1"
              />
            </label>
            <Button type="button" onClick={applyLink}>
              Aplicar link
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={removeLink}
              className="text-danger hover:bg-danger-bg hover:text-danger"
            >
              Remover link
            </Button>
            {linkError ? (
              <p
                id="editor-link-error"
                role="alert"
                className="w-full text-ui-sm text-danger"
              >
                {linkError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
