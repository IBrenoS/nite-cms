import { describe, expect, it } from "vitest";

import { mapPublishedArticle } from "./public-news";

const row = {
  articleId: "10000000-0000-4000-8000-000000000001",
  revisionId: "20000000-0000-4000-8000-000000000001",
  contentSchemaVersion: 1,
  slug: "materia-publicada",
  publishedAt: new Date("2026-08-27T20:00:00.000Z"),
  featured: true,
  title: "Matéria publicada pelo CMS NITE",
  summary:
    "Resumo editorial suficientemente descritivo para validar o contrato público da API.",
  category: "comunidade",
  eventDate: null,
  readTimeMinutes: 4,
  byline: "Redação NITE",
  coverObjectKey: "news/capa principal.webp",
  coverAlt: "Pessoas reunidas em um ambiente universitário iluminado.",
  body: [
    {
      type: "paragraph",
      text: "Texto editorial suficientemente longo para validar o contrato público.",
    },
  ],
  seo: null,
  public: true,
  contentState: "real",
} as const;

describe("DTO público do CMS", () => {
  it("mapeia a view para o contrato HTTP sem dados administrativos", () => {
    expect(mapPublishedArticle(row, "https://media.nite.test/public/")).toEqual(
      expect.objectContaining({
        slug: "materia-publicada",
        publishedAt: "2026-08-27",
        cover: {
          src: "https://media.nite.test/public/news/capa%20principal.webp",
          alt: "Pessoas reunidas em um ambiente universitário iluminado.",
        },
        public: true,
      }),
    );
  });

  it("rejeita JSONB incompatível antes de responder à API", () => {
    expect(() =>
      mapPublishedArticle(
        { ...row, body: [{ type: "script" }] },
        "https://media.nite.test",
      ),
    ).toThrow();
  });
});
