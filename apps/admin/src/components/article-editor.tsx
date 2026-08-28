"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import Blockquote from "@tiptap/extension-blockquote";
import StarterKit from "@tiptap/starter-kit";
import { Button, Input, StatusBadge, Textarea } from "@nite/ui";

import {
  newsBlocksToTiptapDocument,
  newsCategoryValues,
  type EditorialArticleInput,
} from "@nite/content/admin";
import {
  createMediaUploadAction,
  processMediaUploadAction,
  submitEditorialArticle,
  type EditorialActionState,
} from "@/app/(workspace)/articles/actions";

type ArticleEditorProps = {
  initial?: EditorialArticleInput & {
    articleId: string;
    revisionId: string;
    version: number;
    status: "draft" | "published" | "archived";
  };
  canPublish: boolean;
};

const initialActionState: EditorialActionState = { status: "idle" };
const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const EditorialBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      attribution: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attribution"),
        renderHTML: (attributes) =>
          attributes.attribution
            ? { "data-attribution": attributes.attribution }
            : {},
      },
    };
  },
});

export function ArticleEditor({ initial, canPublish }: ArticleEditorProps) {
  const router = useRouter();
  const [actionState, formAction, pending] = useActionState(
    submitEditorialArticle,
    initialActionState,
  );
  const [bodyDocument, setBodyDocument] = useState<JSONContent>(() =>
    initial ? newsBlocksToTiptapDocument(initial.body) : emptyDocument,
  );
  const [mediaId, setMediaId] = useState(initial?.coverMediaId ?? "");
  const [mediaState, setMediaState] = useState<
    "idle" | "uploading" | "processing" | "ready" | "error"
  >(initial?.coverMediaId ? "ready" : "idle");
  const [mediaMessage, setMediaMessage] = useState<string>();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        blockquote: false,
      }),
      EditorialBlockquote,
    ],
    content: bodyDocument,
    immediatelyRender: false,
    onUpdate({ editor: currentEditor }) {
      setBodyDocument(currentEditor.getJSON());
    },
    editorProps: {
      attributes: {
        "aria-label": "Corpo da matéria",
        class: "prose-editor",
      },
    },
  });

  useEffect(() => {
    if (!initial && actionState.articleId) {
      router.replace(`/articles/${actionState.articleId}/edit`);
    }
  }, [actionState.articleId, initial, router]);

  async function uploadCover(file: File) {
    setMediaMessage(undefined);
    setMediaState("uploading");
    try {
      const upload = await createMediaUploadAction({
        mimeType: file.type,
        byteSize: file.size,
      });
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: upload.requiredHeaders,
        body: file,
      });
      if (!response.ok) throw new Error("Upload direto recusado.");
      setMediaState("processing");
      const processed = await processMediaUploadAction(upload.mediaId);
      if (processed.status !== "ready")
        throw new Error("Imagem não promovida.");
      setMediaId(processed.id);
      setMediaState("ready");
      setMediaMessage("Capa validada e convertida para WebP.");
    } catch {
      setMediaState("error");
      setMediaMessage(
        "Não foi possível processar a capa. Use JPEG, PNG ou WebP de até 10 MB.",
      );
    }
  }

  const currentRevisionId = actionState.revisionId ?? initial?.revisionId ?? "";

  return (
    <form
      action={formAction}
      className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <input type="hidden" name="articleId" value={initial?.articleId ?? ""} />
      <input
        type="hidden"
        name="expectedRevisionId"
        value={currentRevisionId}
      />
      <input type="hidden" name="coverMediaId" value={mediaId} />
      <input
        type="hidden"
        name="bodyDocument"
        value={JSON.stringify(bodyDocument)}
      />

      <div className="grid min-w-0 gap-8">
        <section className="grid gap-5 rounded-xl border border-nite-border-subtle p-5 sm:p-6">
          <div className="grid gap-2">
            <label htmlFor="title" className="font-medium">
              Título
            </label>
            <Input
              id="title"
              name="title"
              required
              minLength={12}
              maxLength={100}
              defaultValue={initial?.title}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="summary" className="font-medium">
              Resumo
            </label>
            <Textarea
              id="summary"
              name="summary"
              required
              minLength={48}
              maxLength={220}
              defaultValue={initial?.summary}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="slug" className="font-medium">
                Slug
              </label>
              <Input
                id="slug"
                name="slug"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                defaultValue={initial?.slug}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="category" className="font-medium">
                Categoria
              </label>
              <select
                id="category"
                name="category"
                required
                defaultValue={initial?.category ?? ""}
                className="nite-form-field h-10 rounded-xl border px-3 text-sm outline-none"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {newsCategoryValues.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="editor-surface overflow-hidden rounded-xl border border-nite-border-subtle">
          <div className="flex flex-wrap gap-2 border-b border-nite-border-subtle bg-nite-section p-3">
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("paragraph") ?? false}
              onClick={() => editor?.chain().focus().setParagraph().run()}
            >
              Parágrafo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              Subtítulo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="quiet"
              aria-pressed={editor?.isActive("blockquote") ?? false}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              Citação
            </Button>
          </div>
          <EditorContent editor={editor} className="p-5 sm:p-7" />
        </section>
      </div>

      <aside className="grid content-start gap-5 xl:sticky xl:top-24">
        <section className="grid gap-4 rounded-xl border border-nite-border-subtle p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading font-semibold">Publicação</h2>
            {initial ? (
              <StatusBadge
                status={
                  initial.status === "published" ? "done" : initial.status
                }
                label={`v${initial.version}`}
              />
            ) : null}
          </div>
          <div className="grid gap-2">
            <label htmlFor="byline" className="text-sm font-medium">
              Assinatura
            </label>
            <Input
              id="byline"
              name="byline"
              required
              defaultValue={initial?.byline ?? "Redação NITE"}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label htmlFor="readTimeMinutes" className="text-sm font-medium">
                Leitura
              </label>
              <Input
                id="readTimeMinutes"
                name="readTimeMinutes"
                type="number"
                min={1}
                max={30}
                required
                defaultValue={initial?.readTimeMinutes ?? 4}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="eventDate" className="text-sm font-medium">
                Data do evento
              </label>
              <Input
                id="eventDate"
                name="eventDate"
                type="date"
                defaultValue={initial?.eventDate}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={initial?.featured}
              className="size-4 accent-[var(--nite-brand-primary)]"
            />
            Destacar no Nite News
          </label>
        </section>

        <section className="grid gap-4 rounded-xl border border-nite-border-subtle p-5">
          <h2 className="font-heading font-semibold">Capa</h2>
          <Input
            aria-label="Arquivo de capa"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={mediaState === "uploading" || mediaState === "processing"}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void uploadCover(file);
            }}
          />
          <div className="grid gap-2">
            <label htmlFor="coverAlt" className="text-sm font-medium">
              Texto alternativo
            </label>
            <Textarea
              id="coverAlt"
              name="coverAlt"
              required
              minLength={12}
              defaultValue={initial?.coverAlt}
            />
          </div>
          {mediaState !== "idle" ? (
            <p
              role={mediaState === "error" ? "alert" : "status"}
              className={
                mediaState === "error"
                  ? "text-sm text-status-error"
                  : "text-sm text-nite-text-secondary"
              }
            >
              {mediaMessage ??
                (mediaState === "uploading"
                  ? "Enviando arquivo…"
                  : mediaState === "processing"
                    ? "Validando e convertendo…"
                    : "Capa pronta.")}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 rounded-xl border border-nite-border-subtle p-5">
          <h2 className="font-heading font-semibold">SEO</h2>
          <Input
            aria-label="Título SEO"
            name="seoTitle"
            maxLength={60}
            defaultValue={initial?.seo?.title}
          />
          <Textarea
            aria-label="Descrição SEO"
            name="seoDescription"
            maxLength={160}
            defaultValue={initial?.seo?.description}
          />
        </section>

        {actionState.message ? (
          <p
            role={actionState.status === "success" ? "status" : "alert"}
            className={
              actionState.status === "success"
                ? "text-sm text-status-done"
                : "text-sm text-status-error"
            }
          >
            {actionState.message}
          </p>
        ) : null}

        <div className="grid gap-3">
          <Button
            type="submit"
            name="intent"
            value="save"
            variant="secondary"
            loading={pending}
          >
            Salvar revisão
          </Button>
          {canPublish ? (
            <Button
              type="submit"
              name="intent"
              value="publish"
              loading={pending}
              disabled={mediaState !== "ready"}
              onClick={(event) => {
                const form = event.currentTarget.form;
                if (!form) return;
                const data = new FormData(form);
                const title = String(data.get("title") ?? "esta matéria");
                const slug = String(data.get("slug") ?? "");
                if (
                  !window.confirm(
                    `Publicar “${title}” em /atualizacoes/${slug}?`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              Publicar revisão
            </Button>
          ) : null}
          {initial ? (
            <Button
              render={
                <Link
                  href={`/preview/articles/${initial.articleId}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              variant="quiet"
            >
              Abrir preview
            </Button>
          ) : null}
        </div>
      </aside>
    </form>
  );
}
