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

import DashboardPage from "./page";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
    mocks.requireCmsPageContext.mockResolvedValue({
      database: {},
      membership: {},
    });
    const dashboard = {
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
    mocks.getEditorialArticlesDashboard.mockResolvedValue(dashboard);
    mocks.listEditorialArticles.mockResolvedValue(dashboard.records);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renderiza Nova matéria como link sem warning de semântica de botão", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(await DashboardPage());

    expect(screen.getByRole("link", { name: "Nova matéria" })).toHaveAttribute(
      "href",
      "/articles/new",
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "nativeButton` prop is true",
    );
  });

  it("exibe os totais editoriais retornados pela consulta", async () => {
    render(await DashboardPage());

    const summary = screen.getByRole("region", {
      name: "Resumo das matérias",
    });
    expect(summary).toHaveTextContent("Rascunhos4");
    expect(summary).toHaveTextContent("Publicadas12");
    expect(summary).toHaveTextContent("Arquivadas2");
  });

  it("encaminha busca por título, estado e categoria para o domínio", async () => {
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
      screen.getByRole("combobox", { name: "Filtrar por estado" }),
    ).toHaveValue("published");
    expect(
      screen.getByRole("combobox", { name: "Filtrar por categoria" }),
    ).toHaveValue("tecnologia");
  });

  it("apresenta a matéria com resumo, categoria, revisão, atualização e edição", async () => {
    render(await DashboardPage());

    const article = screen.getByRole("article", {
      name: "Cobertura especial do evento de tecnologia",
    });
    expect(article).toHaveTextContent(
      "Os principais anúncios e conversas que marcaram o encontro de tecnologia.",
    );
    expect(article).toHaveTextContent("Inovação");
    expect(article).toHaveTextContent("v5");
    expect(article).toHaveTextContent("Ontem, 18:15");
    expect(article.querySelector("img")).toHaveAttribute(
      "src",
      "https://media.nite.test/news/capa-tecnologia.webp",
    );
    expect(screen.getByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      "/articles/10000000-0000-4000-8000-000000000001/edit",
    );
  });

  it("aplica o filtro assim que o estado é alterado", async () => {
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => undefined);
    render(await DashboardPage());

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filtrar por estado" }),
      { target: { value: "published" } },
    );

    expect(requestSubmit).toHaveBeenCalledOnce();
  });
});
