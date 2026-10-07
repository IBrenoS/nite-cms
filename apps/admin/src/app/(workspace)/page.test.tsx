import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEditorialArticlesDashboard: vi.fn(),
  listEditorialArticles: vi.fn(),
  requireCmsPageContext: vi.fn(),
}));

vi.mock("@nite/editorial", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nite/editorial")>()),
  getEditorialArticlesDashboard: mocks.getEditorialArticlesDashboard,
  listEditorialArticles: mocks.listEditorialArticles,
}));

vi.mock("@/lib/media-storage", () => ({
  getPublicMediaUrl: (objectKey: string | null | undefined) =>
    objectKey ? `https://media.nite.test/${objectKey}` : undefined,
}));

vi.mock("@/lib/auth", () => ({
  requireCmsPageContext: mocks.requireCmsPageContext,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import DashboardPage from "./page";

const defaultDashboard = {
  counts: { draft: 4, published: 12, archived: 2 },
  records: [
    {
      article: {
        id: "10000000-0000-4000-8000-000000000001",
        slug: "cobertura-especial-evento-tecnologia",
        status: "published",
        updatedAt: new Date("2026-09-05T21:15:00.000Z"),
      },
      revision: {
        title: "Cobertura especial do evento de tecnologia",
        summary:
          "Os principais anúncios e conversas que marcaram o encontro de tecnologia.",
        category: "inovacao",
        version: 5,
        coverAlt: "Pessoas reunidas durante o evento de tecnologia.",
      },
      cover: {
        status: "ready",
        publicObjectKey: "news/capa-tecnologia.webp",
      },
    },
  ],
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
    mocks.requireCmsPageContext.mockResolvedValue({
      database: {},
      membership: {},
    });
    mocks.getEditorialArticlesDashboard.mockResolvedValue(defaultDashboard);
    mocks.listEditorialArticles.mockResolvedValue(defaultDashboard.records);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("apresenta Matérias como mesa de trabalho editorial", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(await DashboardPage());

    expect(
      screen.getByRole("heading", { name: "Matérias" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Acompanhe o que está em produção e o que já foi publicado.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova matéria" })).toHaveAttribute(
      "href",
      "/articles/new",
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "nativeButton` prop is true",
    );
  });

  it("expõe as visões editoriais com linguagem de redação", async () => {
    render(await DashboardPage());

    const views = screen.getByRole("navigation", { name: "Visões editoriais" });
    expect(views).toHaveTextContent("Todas18");
    expect(views).toHaveTextContent("Em produção4");
    expect(views).toHaveTextContent("Publicadas12");
    expect(views).toHaveTextContent("Arquivadas2");
    expect(screen.getByRole("link", { name: "Todas 18" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("preserva busca e categoria ao trocar de visão", async () => {
    const searchParams = Promise.resolve({
      q: " tecnologia ",
      category: "tecnologia",
    });

    render(await Reflect.apply(DashboardPage, undefined, [{ searchParams }]));

    expect(screen.getByRole("link", { name: "Em produção 4" })).toHaveAttribute(
      "href",
      "/?status=draft&q=tecnologia&category=tecnologia",
    );
  });

  it("encaminha busca, visão e categoria para o domínio", async () => {
    const searchParams = Promise.resolve({
      q: " tecnologia ",
      status: "published",
      category: "tecnologia",
    });

    render(await Reflect.apply(DashboardPage, undefined, [{ searchParams }]));

    expect(mocks.getEditorialArticlesDashboard).toHaveBeenCalledWith(
      {},
      {},
      {
        search: "tecnologia",
        status: "published",
        category: "tecnologia",
      },
    );
    expect(
      screen.getByRole("searchbox", { name: "Buscar por título ou slug" }),
    ).toHaveValue("tecnologia");
    expect(
      screen.getByRole("combobox", { name: "Filtrar por categoria" }),
    ).toHaveValue("tecnologia");
    expect(screen.getByRole("link", { name: "Publicadas 12" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("combobox", { name: "Filtrar por estado" }),
    ).not.toBeInTheDocument();
  });

  it("apresenta a matéria como item editorial e reduz metadados administrativos", async () => {
    render(await DashboardPage());

    const article = screen.getByRole("article", {
      name: "Cobertura especial do evento de tecnologia",
    });
    expect(article).toHaveTextContent(
      "Os principais anúncios e conversas que marcaram o encontro de tecnologia.",
    );
    expect(article).toHaveTextContent("Inovação");
    expect(article).toHaveTextContent("Atualizada ontem, 18:15");
    expect(article).not.toHaveTextContent("v5");
    expect(article.querySelector("img")).toHaveAttribute(
      "src",
      "https://media.nite.test/news/capa-tecnologia.webp",
    );
    expect(
      screen
        .getAllByRole("link", {
          name: "Cobertura especial do evento de tecnologia",
        })
        .some(
          (link) =>
            link.getAttribute("href") ===
            "/articles/10000000-0000-4000-8000-000000000001/edit",
        ),
    ).toBe(true);
    expect(
      screen.getAllByRole("button", { name: "Ações da matéria" }).length,
    ).toBeGreaterThan(0);
  });

  it("aplica a categoria assim que o filtro é alterado", async () => {
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => undefined);
    render(await DashboardPage());

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filtrar por categoria" }),
      { target: { value: "tecnologia" } },
    );

    expect(requestSubmit).toHaveBeenCalledOnce();
  });

  it("oferece criação quando a redação ainda não tem matérias", async () => {
    mocks.getEditorialArticlesDashboard.mockResolvedValue({
      counts: { draft: 0, published: 0, archived: 0 },
      records: [],
    });

    render(await DashboardPage());

    expect(screen.getByText("Nenhuma matéria por aqui")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Quando a redação começar uma nova história, ela aparecerá nesta lista.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Nova matéria" })).toHaveLength(
      2,
    );
  });

  it("diferencia ausência de resultados de uma redação vazia", async () => {
    mocks.getEditorialArticlesDashboard.mockResolvedValue({
      counts: { draft: 4, published: 12, archived: 2 },
      records: [],
    });
    const searchParams = Promise.resolve({
      q: "sem resultado",
      status: "draft",
    });

    render(await Reflect.apply(DashboardPage, undefined, [{ searchParams }]));

    expect(
      screen.getByText("Nenhuma matéria corresponde aos filtros"),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Limpar filtros" })
        .every((link) => link.getAttribute("href") === "/?status=draft"),
    ).toBe(true);
  });
});
