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
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/app/(workspace)/articles/actions", () => ({
  createMediaUploadAction: mocks.createUpload,
  createPrivatePreviewLink: mocks.preview,
  processMediaUploadAction: mocks.processUpload,
  submitEditorialArticle: mocks.submit,
  transitionEditorialArticle: mocks.transition,
}));
vi.mock("@/lib/editorial-tiptap", () => ({
  createEditorialTiptapExtensions: () => [],
}));
vi.mock("@tiptap/react", () => ({
  EditorContent: () => <div aria-label="Corpo da matéria" />,
  useEditor: () => ({
    isActive: () => false,
    chain() {
      const chain = {
        focus: () => chain,
        insertContent: () => chain,
        run: () => true,
        setLink: () => chain,
        setParagraph: () => chain,
        toggleBlockquote: () => chain,
        toggleBold: () => chain,
        toggleBulletList: () => chain,
        toggleHeading: () => chain,
        toggleItalic: () => chain,
        toggleOrderedList: () => chain,
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

    expect(
      screen.getByLabelText("Texto alternativo da imagem inline"),
    ).not.toBeRequired();
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
    expect(
      screen.getByRole("button", { name: "Publicar revisão" }),
    ).toBeEnabled();
  });

  it("não oferece arquivamento nem preview antes do primeiro salvamento", () => {
    render(<ArticleEditor canPublish />);

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

  it("separa preview interno e preview do Portal em matéria persistida", () => {
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
      screen.getByRole("link", { name: "Preview no CMS" }),
    ).toHaveAttribute(
      "href",
      `/preview/articles/${initialArticle.articleId}?revision=${initialArticle.revisionId}`,
    );
    expect(
      screen.getByRole("button", { name: "Preview no Portal" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeEnabled();
  });

  it("mostra pendências antes de confirmar uma publicação inválida", () => {
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
    confirm.mockRestore();
  });

  it("salva um rascunho parcial com título e redireciona para a edição", async () => {
    mocks.submit.mockResolvedValue({
      status: "success",
      message: "Nova revisão salva.",
      data: {
        articleId: "10000000-0000-4000-8000-000000000099",
        revisionId: "20000000-0000-4000-8000-000000000099",
      },
    });
    render(<ArticleEditor canPublish />);
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Rascunho parcial" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));

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
});
