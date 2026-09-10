import { describe, expect, it } from "vitest";

import { parseEditorialFormData, zodFieldErrors } from "./editorial-form";

function formData(overrides: Record<string, string> = {}) {
  const values = {
    articleId: "",
    expectedRevisionId: "",
    intent: "save",
    slug: "rascunho",
    slugManuallyEdited: "false",
    title: "Rascunho",
    summary: "",
    category: "",
    eventDate: "",
    byline: "",
    coverMediaId: "",
    coverAlt: "",
    coverCaption: "",
    coverCredit: "",
    seoTitle: "",
    seoDescription: "",
    bodyDocument: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph" }],
    }),
    ...overrides,
  };
  const data = new FormData();
  Object.entries(values).forEach(([name, value]) => data.set(name, value));
  return data;
}

describe("formulário editorial", () => {
  it("aceita rascunho parcial com apenas um título", () => {
    const parsed = parseEditorialFormData(formData());

    expect(parsed.intent).toBe("save");
    expect(parsed.input).toMatchObject({
      title: "Rascunho",
      summary: "",
      category: "",
      byline: "",
      coverMediaId: null,
      coverAlt: "",
      body: { schemaVersion: 3 },
    });
  });

  it("preserva legenda, crédito e largura de imagem ao salvar como V3", () => {
    const parsed = parseEditorialFormData(
      formData({
        coverCaption: "Abertura da semana acadêmica.",
        coverCredit: "Foto: Comunicação NITE",
        bodyDocument: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                mediaId: "30000000-0000-4000-8000-000000000101",
                alt: "Pessoas reunidas no auditório",
                caption: "Público acompanha a abertura.",
                credit: "Foto: Acervo NITE",
                layout: "wide",
              },
            },
          ],
        }),
      }),
    );

    expect(parsed.input).toMatchObject({
      coverCaption: "Abertura da semana acadêmica.",
      coverCredit: "Foto: Comunicação NITE",
      body: {
        schemaVersion: 3,
        content: [
          {
            attrs: {
              caption: "Público acompanha a abertura.",
              credit: "Foto: Acervo NITE",
              layout: "wide",
            },
          },
        ],
      },
    });
  });

  it("associa as pendências de publicação aos campos da interface", () => {
    try {
      parseEditorialFormData(formData({ intent: "publish" }));
      throw new Error("A publicação incompleta deveria falhar.");
    } catch (error) {
      expect(zodFieldErrors(error)).toMatchObject({
        title: expect.any(Array),
        summary: expect.any(Array),
        category: expect.any(Array),
        byline: expect.any(Array),
        body: expect.any(Array),
        coverMedia: expect.any(Array),
        coverAlt: expect.any(Array),
      });
    }
  });

  it("associa JSON inválido do editor ao campo corpo", () => {
    try {
      parseEditorialFormData(formData({ bodyDocument: "{" }));
      throw new Error("O documento inválido deveria falhar.");
    } catch (error) {
      expect(zodFieldErrors(error)).toEqual({
        body: ["O conteúdo da matéria está inválido."],
      });
    }
  });
});
