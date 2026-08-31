import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/app/(workspace)/articles/actions", () => ({
  createMediaUploadAction: vi.fn(),
  createPrivatePreviewLink: vi.fn(),
  processMediaUploadAction: vi.fn(),
  submitEditorialArticle: vi.fn(),
  transitionEditorialArticle: vi.fn(),
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
});
