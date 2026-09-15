import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  submit: vi.fn(),
  createUpload: vi.fn(),
  processUpload: vi.fn(),
  preview: vi.fn(),
  privatePreview: vi.fn(),
  transition: vi.fn(),
  deletionImpact: vi.fn(),
  deleteArticle: vi.fn(),
  uploadFile: vi.fn(),
  insertContent: vi.fn(),
  updateAttributes: vi.fn(),
  imageActive: false,
  videoActive: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/app/(workspace)/articles/actions", () => ({
  createLivePreviewLink: mocks.preview,
  createMediaUploadAction: mocks.createUpload,
  createPrivatePreviewLink: mocks.privatePreview,
  getEditorialArticleDeletionImpactAction: mocks.deletionImpact,
  deleteEditorialArticleAction: mocks.deleteArticle,
  processMediaUploadAction: mocks.processUpload,
  submitEditorialArticle: mocks.submit,
  transitionEditorialArticle: mocks.transition,
}));
vi.mock("@/lib/editorial-tiptap", () => ({
  createEditorialTiptapExtensions: () => [],
  normalizeEditorialPastedHtml: (html: string) => html,
}));
vi.mock("@/lib/media-upload-client", () => ({
  MediaUploadCanceledError: class MediaUploadCanceledError extends Error {},
  uploadMediaFile: mocks.uploadFile,
}));
import { ImageNodeView } from "./editor/image-node-view";
import { VideoNodeView } from "./editor/video-node-view";
import { ArticleEditor } from "./article-editor";

vi.mock("@tiptap/react", () => ({
  NodeViewWrapper: ({
    children,
    as: Component = "div",
    ...props
  }: {
    children?: React.ReactNode;
    as?: React.ElementType;
    [key: string]: unknown;
  }) => <Component {...props}>{children}</Component>,
  EditorContent: () => (
    <div aria-label="Corpo da matéria">
      {mocks.imageActive ? (
        <ImageNodeView
          node={
            {
              attrs: {
                mediaId: "30000000-0000-4000-8000-000000000001",
                alt: "Pessoas no laboratório",
                caption: "Legenda atual",
                credit: "Foto: NITE",
                layout: "wide",
              },
            } as never
          }
          updateAttributes={(attrs) => mocks.updateAttributes("image", attrs)}
          deleteNode={() => mocks.updateAttributes("image", { deleted: true })}
          selected={true}
          editor={null as never}
          getPos={() => 0}
          extension={null as never}
          decorations={[]}
          view={null as never}
          innerDecorations={null as never}
          HTMLAttributes={null as never}
        />
      ) : null}
      {mocks.videoActive ? (
        <VideoNodeView
          node={
            {
              attrs: {
                mediaId: "30000000-0000-4000-8000-000000000201",
                captionsMediaId: "30000000-0000-4000-8000-000000000202",
                playbackMode: "manual",
                layout: "wide",
                description: "Apresentação acessível",
                caption: "Legenda atual",
                credit: "Vídeo: NITE",
              },
            } as never
          }
          updateAttributes={(attrs) => mocks.updateAttributes("video", attrs)}
          deleteNode={() => mocks.updateAttributes("video", { deleted: true })}
          selected={true}
          editor={null as never}
          getPos={() => 0}
          extension={null as never}
          decorations={[]}
          view={null as never}
          innerDecorations={null as never}
          HTMLAttributes={null as never}
        />
      ) : null}
    </div>
  ),
  useEditor: () => ({
    isActive: (name: string) =>
      (name === "image" && mocks.imageActive) ||
      (name === "video" && mocks.videoActive),
    getAttributes: (name: string) =>
      name === "image"
        ? {
            alt: "Pessoas no laboratório",
            caption: "Legenda atual",
            credit: "Foto: NITE",
            layout: "wide",
          }
        : name === "video"
          ? {
              mediaId: "30000000-0000-4000-8000-000000000201",
              captionsMediaId: "30000000-0000-4000-8000-000000000202",
              playbackMode: "manual",
              layout: "wide",
              description: "Apresentação acessível",
              caption: "Legenda atual",
              credit: "Vídeo: NITE",
            }
          : {},
    chain() {
      const chain = {
        focus: () => chain,
        insertContent: (content: unknown) => {
          mocks.insertContent(content);
          return chain;
        },
        deleteSelection: () => chain,
        redo: () => chain,
        run: () => true,
        setLink: () => chain,
        setParagraph: () => chain,
        toggleBlockquote: () => chain,
        toggleBold: () => chain,
        toggleBulletList: () => chain,
        toggleHeading: () => chain,
        toggleItalic: () => chain,
        toggleOrderedList: () => chain,
        undo: () => chain,
        updateAttributes: (name: string, attrs: unknown) => {
          mocks.updateAttributes(name, attrs);
          return chain;
        },
        unsetLink: () => chain,
      };
      return chain;
    },
  }),
}));

const initialArticle = {
  articleId: "10000000-0000-4000-8000-000000000001",
  revisionId: "20000000-0000-4000-8000-000000000001",
  version: 1,
  status: "draft" as const,
  publishedRevisionId: null,
  slug: "agenda-personalizada",
  title: "Laboratório de inovação abre nova agenda",
  summary:
    "A equipe do NITE apresenta uma agenda editorial validada para atividades acadêmicas e projetos aplicados.",
  category: "inovacao" as const,
  byline: "Redação NITE",
  coverMediaId: "30000000-0000-4000-8000-000000000001",
  coverAlt: "Estudantes reunidos em um laboratório de inovação universitário.",
  featured: false,
  body: {
    schemaVersion: 1 as const,
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [
          {
            type: "text" as const,
            text: "Conteúdo editorial usado pelo teste do formulário.",
          },
        ],
      },
    ],
  },
};

describe("ArticleEditor", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.submit.mockReset();
    mocks.createUpload.mockReset();
    mocks.processUpload.mockReset();
    mocks.preview.mockReset();
    mocks.privatePreview.mockReset();
    mocks.transition.mockReset();
    mocks.deletionImpact.mockReset();
    mocks.deleteArticle.mockReset();
    mocks.uploadFile.mockReset();
    mocks.insertContent.mockReset();
    mocks.updateAttributes.mockReset();
    mocks.imageActive = false;
    mocks.videoActive = false;
    mocks.submit.mockResolvedValue({ status: "idle" });
    mocks.transition.mockResolvedValue({ status: "success" });
    mocks.privatePreview.mockResolvedValue({ status: "idle" });
    mocks.uploadFile.mockResolvedValue(undefined);
  });

  it("mostra exclusão apenas para administradora e exige EXCLUIR", async () => {
    mocks.deletionImpact.mockResolvedValue({
      status: "success",
      data: {
        title: initialArticle.title,
        slug: initialArticle.slug,
        status: "draft",
        revisionCount: 5,
        snapshotCount: 2,
        mediaCount: 3,
        exclusiveMediaCount: 2,
        sharedMediaCount: 1,
      },
    });
    mocks.deleteArticle.mockResolvedValue({
      status: "success",
      data: { scheduledMediaCount: 2 },
      message: "Matéria excluída. Limpeza de 2 mídias agendada.",
    });
    const { rerender } = render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Excluir matéria" }),
    ).toBeNull();

    rerender(
      <ArticleEditor
        canPublish
        canDelete
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir matéria" }));
    expect(await screen.findByText(/5 versões e 2 previews/u)).toBeTruthy();
    expect(screen.getByText(/2 mídias exclusivas/u)).toBeTruthy();
    const confirm = screen.getByRole("button", {
      name: "Excluir definitivamente",
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Digite EXCLUIR para confirmar"), {
      target: { value: "EXCLUIR" },
    });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/?deletedMedia=2");
    });
  });

  it("acompanha o titulo ate a primeira edicao manual do slug", () => {
    const { container } = render(<ArticleEditor canPublish />);
    const title = screen.getByLabelText("Título");
    const slug = screen.getByLabelText("Slug");
    const manualState = container.querySelector<HTMLInputElement>(
      'input[name="slugManuallyEdited"]',
    );

    fireEvent.change(title, {
      target: { value: "Laboratório de inovação confirma nova agenda" },
    });
    expect(slug).toHaveValue("laboratorio-de-inovacao-confirma-nova-agenda");
    expect(manualState).toHaveValue("false");

    fireEvent.change(slug, { target: { value: "agenda-personalizada" } });
    fireEvent.change(title, {
      target: { value: "Laboratório de inovação divulga outra agenda" },
    });
    expect(slug).toHaveValue("agenda-personalizada");
    expect(manualState).toHaveValue("true");
  });

  it("preserva o estado manual carregado em outra sessao", () => {
    const { container } = render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: true,
          slugLocked: false,
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Laboratório de inovação apresenta nova programação" },
    });
    expect(screen.getByLabelText("Slug")).toHaveValue("agenda-personalizada");
    expect(
      container.querySelector('input[name="slugManuallyEdited"]'),
    ).toHaveValue("true");
  });

  it("torna o slug somente leitura depois da primeira publicacao", () => {
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: true,
        }}
      />,
    );

    const slug = screen.getByLabelText("Slug");
    expect(slug).toHaveAttribute("readonly");
    expect(
      screen.getByText(
        "O slug foi bloqueado permanentemente na primeira publicação.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Laboratório de inovação altera o título publicado" },
    });
    expect(slug).toHaveValue("agenda-personalizada");
  });

  it("não deixa o campo auxiliar de imagem bloquear o formulário principal", () => {
    const { container } = render(<ArticleEditor canPublish />);

    fireEvent.click(
      screen.getByRole("button", { name: "Inserir imagem no conteúdo" }),
    );
    expect(
      screen.getByLabelText("Texto alternativo da imagem inline"),
    ).not.toBeRequired();
    expect(
      screen.getByLabelText("Legenda da imagem inline"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Crédito da imagem inline"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Largura da imagem inline")).toHaveValue(
      "normal",
    );
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    expect(
      screen.getByRole("button", { name: "Publicar matéria" }),
    ).toBeEnabled();
  });

  it("não oferece arquivamento nem preview antes do primeiro salvamento", () => {
    render(<ArticleEditor canPublish />);

    expect(
      screen.getByRole("heading", { name: "Nova matéria" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ainda não salva")).toBeInTheDocument();
    expect(screen.getByText("1 de 6")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar rascunho" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Visualizar" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Arquivar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Preview no CMS" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Preview no Portal" }),
    ).not.toBeInTheDocument();
  });

  it("oferece preview ao vivo no CMS e no Portal em matéria persistida", () => {
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Preview no CMS" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Preview no Portal" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeEnabled();
    expect(
      screen.getAllByText("Alterações atuais · expira em 10 min."),
    ).toHaveLength(2);
    expect(
      screen.getByText("O preview não salva uma nova revisão."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Editar matéria" }),
    ).toBeInTheDocument();
  });

  it("abre os dois previews com os valores atuais sem salvar a revisão", async () => {
    mocks.preview.mockImplementation(
      async (target: "cms" | "portal", data: FormData) => ({
        status: "success",
        data: {
          url: `${target === "cms" ? "/preview/local" : "https://portal.nite.test/preview"}?title=${encodeURIComponent(String(data.get("title")))}`,
        },
      }),
    );
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Título atual ainda não salvo" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview no CMS" }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        "/preview/local?title=T%C3%ADtulo%20atual%20ainda%20n%C3%A3o%20salvo",
        "_blank",
        "noopener,noreferrer",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview no Portal" }));
    await waitFor(() =>
      expect(open).toHaveBeenLastCalledWith(
        "https://portal.nite.test/preview?title=T%C3%ADtulo%20atual%20ainda%20n%C3%A3o%20salvo",
        "_blank",
        "noopener,noreferrer",
      ),
    );
    expect(screen.getByText("Alterações não salvas")).toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("mostra a capa atual e os rótulos editoriais do design aprovado", () => {
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          coverUrl: "https://media.nite.test/capa.webp",
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );

    expect(
      screen.getByRole("img", { name: initialArticle.coverAlt }),
    ).toHaveAttribute("src", expect.stringContaining("capa.webp"));
    expect(screen.getByRole("option", { name: "Inovação" })).toHaveValue(
      "inovacao",
    );
    expect(screen.getByText("Preparação")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Capa da matéria" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Aparência na busca (opcional)"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Intertítulo (H2)")).toBeInTheDocument();
    expect(screen.getByLabelText("Subseção (H3)")).toBeInTheDocument();
    expect(screen.getByLabelText("Desfazer (Ctrl+Z)")).toBeInTheDocument();
    expect(screen.getByLabelText("Refazer (Ctrl+Shift+Z)")).toBeInTheDocument();
  });

  it("substitui o prompt por edição acessível de link", () => {
    const prompt = vi.spyOn(window, "prompt");
    render(<ArticleEditor canPublish />);

    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    const input = screen.getByLabelText("URL do link");
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar link" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use http, https, mailto ou um caminho interno.",
    );
    expect(prompt).not.toHaveBeenCalled();
    prompt.mockRestore();
  });

  it("oferece metadados, largura e remoção para a imagem selecionada", () => {
    mocks.imageActive = true;
    render(<ArticleEditor canPublish />);

    expect(
      screen.getByRole("heading", { name: "Editar imagem interna" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Alt da imagem selecionada")).toHaveValue(
      "Pessoas no laboratório",
    );
    expect(screen.getByLabelText("Legenda da imagem selecionada")).toHaveValue(
      "Legenda atual",
    );
    expect(screen.getByLabelText("Largura da imagem selecionada")).toHaveValue(
      "wide",
    );
    expect(
      screen.getByRole("button", { name: "Remover imagem do conteúdo" }),
    ).toBeEnabled();
  });

  it("avisa o navegador ao sair com alterações não salvas", () => {
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Título alterado ainda não salvo" },
    });
    const event = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("atualiza revisão e sinaliza alterações ainda não publicadas após salvar", async () => {
    const nextRevisionId = "20000000-0000-4000-8000-000000000002";
    mocks.submit.mockResolvedValue({
      status: "success",
      message: "Nova revisão salva.",
      data: {
        articleId: initialArticle.articleId,
        revisionId: nextRevisionId,
        version: 2,
        status: "published",
        publishedRevisionId: initialArticle.revisionId,
      },
    });
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          status: "published",
          publishedRevisionId: initialArticle.revisionId,
          slugManuallyEdited: false,
          slugLocked: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(
      screen.getByText("Alterações não publicadas · v2"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview no CMS" }),
    ).toBeEnabled();
  });

  it("abre uma revisão histórica no preview privado do Portal", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    mocks.privatePreview.mockResolvedValue({
      status: "success",
      data: { url: "https://portal.nite.test/api/preview?token=historica" },
    });
    render(
      <ArticleEditor
        canPublish
        revisions={[
          {
            id: initialArticle.revisionId,
            version: 1,
            title: initialArticle.title,
            createdAt: new Date("2026-09-12T12:00:00.000Z"),
          },
        ]}
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Revisões/u }));
    fireEvent.click(screen.getByRole("button", { name: "Visualizar versão" }));

    await waitFor(() =>
      expect(mocks.privatePreview).toHaveBeenCalledWith({
        articleId: initialArticle.articleId,
        revisionId: initialArticle.revisionId,
      }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://portal.nite.test/api/preview?token=historica",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });

  it("mostra pendências e leva ao título antes de confirmar uma publicação inválida", async () => {
    const confirm = vi.spyOn(window, "confirm");
    render(<ArticleEditor canPublish />);

    fireEvent.click(screen.getByRole("button", { name: "Publicar matéria" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revise os campos destacados.",
    );
    await waitFor(() => expect(screen.getByLabelText("Título")).toHaveFocus());
    confirm.mockRestore();
  });

  it("salva um rascunho parcial com título e redireciona para a edição", async () => {
    mocks.submit.mockResolvedValue({
      status: "success",
      message: "Nova revisão salva.",
      data: {
        articleId: "10000000-0000-4000-8000-000000000099",
        revisionId: "20000000-0000-4000-8000-000000000099",
        version: 1,
        status: "draft",
        publishedRevisionId: null,
      },
    });
    render(<ArticleEditor canPublish />);
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Rascunho parcial" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        "/articles/10000000-0000-4000-8000-000000000099/edit",
      ),
    );
  });

  it("exige texto alternativo somente ao inserir uma imagem inline pronta", async () => {
    mocks.createUpload.mockResolvedValue({
      status: "success",
      data: {
        mediaId: "30000000-0000-4000-8000-000000000099",
        uploadUrl: "https://upload.nite.test/inline",
        requiredHeaders: { "content-type": "image/png" },
        expiresAt: new Date().toISOString(),
      },
    });
    mocks.processUpload.mockResolvedValue({
      status: "success",
      data: {
        id: "30000000-0000-4000-8000-000000000099",
        mediaStatus: "ready",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<ArticleEditor canPublish />);

    fireEvent.click(
      screen.getByRole("button", { name: "Inserir imagem no conteúdo" }),
    );
    fireEvent.change(screen.getByLabelText("Imagem inline pronta"), {
      target: {
        files: [new File(["imagem"], "inline.png", { type: "image/png" })],
      },
    });
    const insert = screen.getByRole("button", { name: "Inserir imagem" });
    await waitFor(() => expect(insert).toBeEnabled());
    fireEvent.click(insert);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe o texto alternativo antes de inserir a imagem.",
    );
    vi.unstubAllGlobals();
  });

  it("envia MP4 e WebVTT, mostra progresso e insere vídeo estruturado", async () => {
    mocks.createUpload
      .mockResolvedValueOnce({
        status: "success",
        data: {
          mediaId: "30000000-0000-4000-8000-000000000201",
          uploadUrl: "https://upload.nite.test/video",
          requiredHeaders: { "content-type": "video/mp4" },
          expiresAt: new Date().toISOString(),
        },
      })
      .mockResolvedValueOnce({
        status: "success",
        data: {
          mediaId: "30000000-0000-4000-8000-000000000202",
          uploadUrl: "https://upload.nite.test/captions",
          requiredHeaders: { "content-type": "text/vtt" },
          expiresAt: new Date().toISOString(),
        },
      });
    mocks.processUpload
      .mockResolvedValueOnce({
        status: "success",
        data: {
          id: "30000000-0000-4000-8000-000000000201",
          mediaKind: "video",
          mediaStatus: "ready",
          durationMs: 18 * 60 * 1_000,
          hasAudio: true,
        },
      })
      .mockResolvedValueOnce({
        status: "success",
        data: {
          id: "30000000-0000-4000-8000-000000000202",
          mediaKind: "captions",
          mediaStatus: "ready",
        },
      });
    mocks.uploadFile.mockImplementation(
      async ({ onProgress }: { onProgress?: (value: number) => void }) => {
        onProgress?.(50);
        onProgress?.(100);
      },
    );
    render(<ArticleEditor canPublish />);

    fireEvent.click(
      screen.getByRole("button", { name: "Inserir vídeo no conteúdo" }),
    );
    fireEvent.change(screen.getByLabelText("Vídeo MP4"), {
      target: {
        files: [new File(["video"], "apresentacao.mp4", { type: "video/mp4" })],
      },
    });
    await waitFor(() =>
      expect(
        screen.getByText("Vídeo MP4 pronto para inserir."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/Este vídeo contém áudio/u)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Legenda WebVTT pt-BR"), {
      target: {
        files: [new File(["WEBVTT"], "pt-BR.vtt", { type: "text/vtt" })],
      },
    });
    await waitFor(() =>
      expect(
        screen.getByText("Legenda WebVTT pt-BR pronta."),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Descrição acessível do vídeo"), {
      target: { value: "Apresentação do NiteNews" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Inserir vídeo" }));

    expect(mocks.createUpload).toHaveBeenNthCalledWith(1, {
      mediaKind: "video",
      mimeType: "video/mp4",
      byteSize: 5,
    });
    expect(mocks.createUpload).toHaveBeenNthCalledWith(2, {
      mediaKind: "captions",
      mimeType: "text/vtt",
      byteSize: 6,
    });
    expect(mocks.insertContent).toHaveBeenCalledWith({
      type: "video",
      attrs: {
        mediaId: "30000000-0000-4000-8000-000000000201",
        captionsMediaId: "30000000-0000-4000-8000-000000000202",
        playbackMode: "manual",
        layout: "normal",
        description: "Apresentação do NiteNews",
      },
    });
  });

  it("permite editar, substituir anexos e remover vídeo selecionado", () => {
    mocks.videoActive = true;
    render(<ArticleEditor canPublish />);

    expect(
      screen.getByRole("heading", { name: "Editar vídeo interno" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reprodução do vídeo selecionado"), {
      target: { value: "autoplay" },
    });
    expect(mocks.updateAttributes).toHaveBeenCalledWith("video", {
      playbackMode: "autoplay",
    });
    expect(
      screen.getByLabelText("Substituir vídeo selecionado"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Substituir legenda do vídeo selecionado"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover vídeo do conteúdo" }),
    ).toBeEnabled();
  });

  it("recupera o CTA de preview quando a chamada falha antes de retornar", async () => {
    mocks.preview.mockRejectedValue(new Error("falha de transporte"));
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );
    const preview = screen.getByRole("button", { name: "Preview no Portal" });

    fireEvent.click(preview);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Não foi possível abrir o preview no Portal.",
      ),
    );
    expect(preview).toBeEnabled();
  });

  it("explica quando o Preview no Portal não está configurado", async () => {
    mocks.preview.mockResolvedValue({
      status: "operation_error",
      code: "preview_unavailable",
      message:
        "O Preview no Portal não está configurado neste ambiente. A revisão permanece disponível no Preview do CMS.",
      retryable: false,
    });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Alteração local ainda não salva" },
    });
    const preview = screen.getByRole("button", { name: "Preview no Portal" });

    fireEvent.click(preview);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "O Preview no Portal não está configurado neste ambiente. A revisão permanece disponível no Preview do CMS.",
      ),
    );
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Alteração local ainda não salva",
    );
    expect(open).not.toHaveBeenCalled();
    expect(preview).toBeEnabled();
    open.mockRestore();
  });

  it("mostra o código de suporte em falha inesperada do preview", async () => {
    mocks.preview.mockResolvedValue({
      status: "unexpected_error",
      message: "Não foi possível concluir a operação editorial.",
      errorId: "preview-error-id",
    });
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview no Portal" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Código de suporte: preview-error-id.",
      ),
    );
  });

  it("abre modal acessível para confirmar publicação sem usar window.confirm", async () => {
    const confirm = vi.spyOn(window, "confirm");
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publicar matéria" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Publicar matéria no Portal?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /ficará visível publicamente em \/atualizacoes\/agenda-personalizada/,
      ),
    ).toBeInTheDocument();

    const dialogConfirmBtn = screen.getByRole("button", {
      name: "Confirmar publicação",
    });
    expect(dialogConfirmBtn).toBeInTheDocument();
    fireEvent.click(dialogConfirmBtn);

    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("abre modal acessível para transição de ciclo de vida sem usar window.confirm", async () => {
    const confirm = vi.spyOn(window, "confirm");
    render(
      <ArticleEditor
        canPublish
        initial={{
          ...initialArticle,
          status: "published",
          slugManuallyEdited: false,
          slugLocked: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Despublicar" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Despublicar matéria?" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Despublicar matéria" }),
    );

    await waitFor(() =>
      expect(mocks.transition).toHaveBeenCalledWith({
        articleId: initialArticle.articleId,
        expectedRevisionId: initialArticle.revisionId,
        intent: "unpublish",
      }),
    );
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("permite abrir o painel de configurações na barra inferior e fechar com Escape", async () => {
    render(<ArticleEditor canPublish />);

    const openButton = screen.getByRole("button", { name: "Configurações" });
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(openButton);

    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: "Configurações da matéria" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Configurações da matéria" }),
      ).toBeNull();
    });
  });
});
