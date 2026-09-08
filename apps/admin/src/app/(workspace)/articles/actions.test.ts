import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  getPreview: vi.fn(),
  validatePreview: vi.fn(),
  createSnapshot: vi.fn(),
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
    createEditorialPreviewSnapshot: mocks.createSnapshot,
  };
});

import { editorialPublishableInputSchema } from "@nite/editorial";

import {
  createLivePreviewLink,
  createPrivatePreviewLink,
  submitEditorialArticle,
} from "./actions";

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

function publishablePreviewForm() {
  const data = draftForm("publish");
  data.set("articleId", "10000000-0000-4000-8000-000000000001");
  data.set("expectedRevisionId", "20000000-0000-4000-8000-000000000003");
  data.set("slug", "slug-ainda-nao-salvo");
  data.set("title", "Título atual ainda não salvo como revisão");
  data.set(
    "summary",
    "Resumo atual com conteúdo suficiente para o contrato editorial do preview privado.",
  );
  data.set("category", "inovacao");
  data.set("byline", "Redação NITE");
  data.set("coverMediaId", "30000000-0000-4000-8000-000000000001");
  data.set("coverAlt", "Equipe revisando uma matéria no laboratório.");
  data.set(
    "bodyDocument",
    JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Conteúdo atual." }],
        },
      ],
    }),
  );
  return data;
}

describe("ações do editor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    mocks.submit.mockReset();
    mocks.requireContext.mockReset();
    mocks.after.mockReset();
    mocks.getPreview.mockReset();
    mocks.validatePreview.mockReset();
    mocks.createSnapshot.mockReset();
    mocks.requireContext.mockResolvedValue({
      database: {},
      membership: { id: "membership-id" },
    });
  });

  it("cria preview interno das alterações atuais sem salvar revisão", async () => {
    mocks.createSnapshot.mockResolvedValue({
      id: "40000000-0000-4000-8000-000000000001",
    });

    const result = await createLivePreviewLink("cms", publishablePreviewForm());

    expect(result).toEqual({
      status: "success",
      data: {
        url: "/preview/articles/10000000-0000-4000-8000-000000000001?snapshot=40000000-0000-4000-8000-000000000001",
      },
    });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("emite token v2 para o snapshot atual no Portal", async () => {
    mocks.createSnapshot.mockResolvedValue({
      id: "40000000-0000-4000-8000-000000000001",
    });
    vi.stubEnv("PREVIEW_HMAC_SECRET", "x".repeat(32));
    vi.stubEnv("PORTAL_PREVIEW_URL", "https://portal.nite.test/api/preview");

    const result = await createLivePreviewLink(
      "portal",
      publishablePreviewForm(),
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Preview não emitido.");
    expect(new URL(result.data.url).searchParams.get("token")).toMatch(
      /^v2\.[^.]+\.[^.]+$/u,
    );
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("retorna os IDs persistidos ao salvar um rascunho parcial", async () => {
    mocks.submit.mockResolvedValue({
      article: {
        id: "10000000-0000-4000-8000-000000000001",
        status: "draft",
        publishedRevisionId: null,
      },
      revision: {
        id: "20000000-0000-4000-8000-000000000001",
        version: 1,
      },
    });

    await expect(
      submitEditorialArticle({ status: "idle" }, draftForm()),
    ).resolves.toEqual({
      status: "success",
      message: "Nova revisão salva.",
      data: {
        articleId: "10000000-0000-4000-8000-000000000001",
        revisionId: "20000000-0000-4000-8000-000000000001",
        version: 1,
        status: "draft",
        publishedRevisionId: null,
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
      article: {
        id: "10000000-0000-4000-8000-000000000001",
        status: "published",
        publishedRevisionId: "20000000-0000-4000-8000-000000000001",
      },
      revision: {
        id: "20000000-0000-4000-8000-000000000001",
        version: 1,
      },
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

  it("trata preview não configurado como indisponibilidade esperada", async () => {
    mocks.getPreview.mockResolvedValue({ article: {}, revision: {} });
    mocks.validatePreview.mockResolvedValue({});
    vi.stubEnv("PREVIEW_HMAC_SECRET", "x".repeat(32));
    vi.stubEnv("PORTAL_PREVIEW_URL", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await createPrivatePreviewLink({
      articleId: "10000000-0000-4000-8000-000000000001",
      revisionId: "20000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      status: "operation_error",
      code: "preview_unavailable",
      message:
        "O Preview no Portal não está configurado neste ambiente. A revisão permanece disponível no Preview do CMS.",
      retryable: false,
    });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("continua emitindo um link assinado quando o preview está configurado", async () => {
    mocks.getPreview.mockResolvedValue({ article: {}, revision: {} });
    mocks.validatePreview.mockResolvedValue({});
    vi.stubEnv("PREVIEW_HMAC_SECRET", "x".repeat(32));
    vi.stubEnv("PORTAL_PREVIEW_URL", "https://portal.nite.test/api/preview");

    const result = await createPrivatePreviewLink({
      articleId: "10000000-0000-4000-8000-000000000001",
      revisionId: "20000000-0000-4000-8000-000000000001",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Preview não emitido.");
    const url = new URL(result.data.url);
    expect(url.origin).toBe("https://portal.nite.test");
    expect(url.pathname).toBe("/api/preview");
    expect(url.searchParams.get("token")).toMatch(/^v1\.[^.]+\.[^.]+$/u);
  });
});
