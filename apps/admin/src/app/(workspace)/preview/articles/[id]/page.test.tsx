import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRevision: vi.fn(),
  getSnapshot: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  requireContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  requireCmsPageContext: mocks.requireContext,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@nite/editorial", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nite/editorial")>();
  return {
    ...actual,
    getEditorialRevisionPreview: mocks.getRevision,
    getEditorialPreviewSnapshot: mocks.getSnapshot,
  };
});

import ArticlePreviewPage from "./page";

describe("Preview no CMS", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza o snapshot atual em vez da revisão-base", async () => {
    mocks.requireContext.mockResolvedValue({
      database: {
        select: () => ({
          from: () => ({ where: () => ({ limit: async () => [] }) }),
        }),
      },
      membership: { id: "00000000-0000-4000-8000-000000000001" },
    });
    mocks.getSnapshot.mockResolvedValue({
      article: {
        id: "10000000-0000-4000-8000-000000000001",
        publishedAt: null,
      },
      snapshot: {
        id: "40000000-0000-4000-8000-000000000001",
        baseRevisionId: "20000000-0000-4000-8000-000000000003",
      },
      input: {
        slug: "slug-atual",
        title: "Título atual ainda não salvo como revisão",
        summary:
          "Resumo atual com conteúdo suficiente para o contrato editorial do preview privado.",
        category: "inovacao",
        byline: "Redação NITE",
        coverMediaId: "30000000-0000-4000-8000-000000000001",
        coverAlt: "Equipe revisando a matéria no laboratório.",
        featured: false,
        body: {
          schemaVersion: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Conteúdo atual." }],
            },
          ],
        },
      },
    });

    render(
      await ArticlePreviewPage({
        params: Promise.resolve({
          id: "10000000-0000-4000-8000-000000000001",
        }),
        searchParams: Promise.resolve({
          snapshot: "40000000-0000-4000-8000-000000000001",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Título atual ainda não salvo como revisão",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Preview ao vivo · expira em 10 min"),
    ).toBeInTheDocument();
    expect(mocks.getRevision).not.toHaveBeenCalled();
  });

  it("não recua para a revisão salva quando o snapshot é inválido", async () => {
    mocks.requireContext.mockResolvedValue({ database: {}, membership: {} });

    await expect(
      ArticlePreviewPage({
        params: Promise.resolve({
          id: "10000000-0000-4000-8000-000000000001",
        }),
        searchParams: Promise.resolve({ snapshot: "snapshot-invalido" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getSnapshot).not.toHaveBeenCalled();
    expect(mocks.getRevision).not.toHaveBeenCalled();
  });
});
