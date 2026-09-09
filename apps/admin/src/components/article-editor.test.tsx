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
  transition: vi.fn(),
  imageActive: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/app/(workspace)/articles/actions", () => ({
  createLivePreviewLink: mocks.preview,
  createMediaUploadAction: mocks.createUpload,
  createPrivatePreviewLink: mocks.preview,
  processMediaUploadAction: mocks.processUpload,
  submitEditorialArticle: mocks.submit,
  transitionEditorialArticle: mocks.transition,
}));
vi.mock("@/lib/editorial-tiptap", () => ({
  createEditorialTiptapExtensions: () => [],
  normalizeEditorialPastedHtml: (html: string) => html,
}));
vi.mock("@tiptap/react", () => ({
  EditorContent: () => <div aria-label="Corpo da matéria" />,
  useEditor: () => ({
    isActive: (name: string) => name === "image" && mocks.imageActive,
    getAttributes: (name: string) =>
      name === "image"
        ? {
            alt: "Pessoas no laboratório",
            caption: "Legenda atual",
            credit: "Foto: NITE",
            layout: "wide",
          }
        : {},
    chain() {
      const chain = {
        focus: () => chain,
        insertContent: () => chain,
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
        updateAttributes: () => chain,
        unsetLink: () => chain,
      };
      return chain;
    },
  }),
}));

import { ArticleEditor } from "./article-editor";

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
    mocks.transition.mockReset();
    mocks.imageActive = false;
    mocks.submit.mockResolvedValue({ status: "idle" });
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
      screen.getByRole("button", { name: "Publicar revisão" }),
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

  it("mostra pendências e leva ao título antes de confirmar uma publicação inválida", async () => {
    const confirm = vi.spyOn(window, "confirm");
    render(<ArticleEditor canPublish />);

    fireEvent.click(screen.getByRole("button", { name: "Publicar revisão" }));

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
});
