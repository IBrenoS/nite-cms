import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  getPreview: vi.fn(),
  validatePreview: vi.fn(),
  requireContext: vi.fn(),
  after: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/auth", () => ({ requireCmsContext: mocks.requireContext }));
vi.mock("@nite/editorial", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nite/editorial")>();
  return {
    ...actual,
    submitEditorialRevision: mocks.submit,
    getEditorialRevisionPreview: mocks.getPreview,
    validateEditorialRevisionForPublication: mocks.validatePreview,
  };
});

import { editorialPublishableInputSchema } from "@nite/editorial";

import { createPrivatePreviewLink, submitEditorialArticle } from "./actions";

function draftForm(intent: "save" | "publish" = "save") {
  const data = new FormData();
  const fields = {
    articleId: "",
    expectedRevisionId: "",
    intent,
    slug: "rascunho-parcial",
    slugManuallyEdited: "false",
    title: "Rascunho parcial",
    summary: "",
    category: "",
    eventDate: "",
    byline: "",
    coverMediaId: "",
    coverAlt: "",
    seoTitle: "",
    seoDescription: "",
    bodyDocument: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    }),
  };
  Object.entries(fields).forEach(([name, value]) => data.set(name, value));
  return data;
}

describe("ações do editor", () => {
  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.requireContext.mockReset();
    mocks.after.mockReset();
    mocks.getPreview.mockReset();
    mocks.validatePreview.mockReset();
    mocks.requireContext.mockResolvedValue({
      database: {},
      membership: { id: "membership-id" },
    });
  });

  it("retorna os IDs persistidos ao salvar um rascunho parcial", async () => {
    mocks.submit.mockResolvedValue({
      article: { id: "10000000-0000-4000-8000-000000000001" },
      revision: { id: "20000000-0000-4000-8000-000000000001" },
    });

    await expect(
      submitEditorialArticle({ status: "idle" }, draftForm()),
    ).resolves.toEqual({
      status: "success",
      message: "Nova revisão salva.",
      data: {
        articleId: "10000000-0000-4000-8000-000000000001",
        revisionId: "20000000-0000-4000-8000-000000000001",
      },
    });
  });

  it("não chama o domínio quando a publicação falha na validação", async () => {
    const result = await submitEditorialArticle(
      { status: "idle" },
      draftForm("publish"),
    );

    expect(result).toMatchObject({
      status: "validation_error",
      fieldErrors: {
        summary: expect.any(Array),
        category: expect.any(Array),
        coverMedia: expect.any(Array),
      },
    });
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("agenda a outbox somente depois de uma publicação concluída", async () => {
    mocks.submit.mockResolvedValue({
      article: { id: "10000000-0000-4000-8000-000000000001" },
      revision: { id: "20000000-0000-4000-8000-000000000001" },
    });
    const data = draftForm("publish");
    data.set("slug", "materia-publicavel");
    data.set("title", "Matéria editorial pronta para publicar");
    data.set(
      "summary",
      "Resumo editorial completo o suficiente para validar a publicação da matéria no Portal NITE.",
    );
    data.set("category", "inovacao");
    data.set("byline", "Redação NITE");
    data.set("coverMediaId", "30000000-0000-4000-8000-000000000001");
    data.set("coverAlt", "Estudantes reunidos em um laboratório de inovação.");
    data.set(
      "bodyDocument",
      JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Conteúdo publicável." }],
          },
        ],
      }),
    );

    const result = await submitEditorialArticle({ status: "idle" }, data);

    expect(result.status).toBe("success");
    expect(mocks.after).toHaveBeenCalledOnce();
  });

  it("não emite preview do Portal para uma revisão incompleta", async () => {
    mocks.getPreview.mockResolvedValue({ article: {}, revision: {} });
    mocks.validatePreview.mockImplementation(() =>
      editorialPublishableInputSchema.parse({
        slug: "rascunho",
        title: "Rascunho",
        summary: "",
        category: "",
        byline: "",
        featured: false,
        coverMediaId: null,
        coverAlt: "",
        body: {
          schemaVersion: 1,
          type: "doc",
          content: [{ type: "paragraph", content: [] }],
        },
      }),
    );

    const result = await createPrivatePreviewLink({
      articleId: "10000000-0000-4000-8000-000000000001",
      revisionId: "20000000-0000-4000-8000-000000000001",
    });

    expect(result).toMatchObject({
      status: "validation_error",
      fieldErrors: {
        title: expect.any(Array),
        summary: expect.any(Array),
        category: expect.any(Array),
        coverMedia: expect.any(Array),
      },
    });
  });
});
