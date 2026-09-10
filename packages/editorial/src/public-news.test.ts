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
  coverCaption: null,
  coverCredit: null,
  body: {
    schemaVersion: 1,
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Texto editorial suficientemente longo para validar o contrato público.",
          },
        ],
      },
      {
        type: "image",
        attrs: {
          mediaId: "30000000-0000-4000-8000-000000000101",
          alt: "Atividade universitária em laboratório.",
        },
      },
    ],
  },
  bodyMedia: {
    "30000000-0000-4000-8000-000000000101": {
      mediaKind: "image",
      objectKey: "news/imagem editorial.webp",
      mimeType: "image/webp",
      width: 1200,
      height: 675,
    },
  },
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
        body: {
          schemaVersion: 1,
          type: "doc",
          content: [
            expect.anything(),
            {
              type: "image",
              attrs: {
                mediaId: "30000000-0000-4000-8000-000000000101",
                alt: "Atividade universitária em laboratório.",
                src: "https://media.nite.test/public/news/imagem%20editorial.webp",
                width: 1200,
                height: 675,
              },
            },
          ],
        },
        public: true,
      }),
    );
  });

  it("rejeita JSONB incompatível antes de responder à API", () => {
    expect(() =>
      mapPublishedArticle(
        {
          ...row,
          body: {
            schemaVersion: 1,
            type: "doc",
            content: [{ type: "script" }],
          },
        },
        "https://media.nite.test",
      ),
    ).toThrow();
  });

  it("expõe legenda, crédito e layout de mídia dos documentos V2", () => {
    const article = mapPublishedArticle(
      {
        ...row,
        contentSchemaVersion: 2,
        coverCaption: "Encontro da comunidade acadêmica.",
        coverCredit: "Foto: Comunicação NITE",
        body: {
          schemaVersion: 2,
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                mediaId: "30000000-0000-4000-8000-000000000101",
                alt: "Atividade universitária em laboratório.",
                caption: "Estudantes durante a oficina.",
                credit: "Foto: Acervo NITE",
                layout: "full",
              },
            },
          ],
        },
      },
      "https://media.nite.test/public/",
    );

    expect(article.cover).toEqual({
      src: "https://media.nite.test/public/news/capa%20principal.webp",
      alt: "Pessoas reunidas em um ambiente universitário iluminado.",
      caption: "Encontro da comunidade acadêmica.",
      credit: "Foto: Comunicação NITE",
    });
    expect(article.body).toMatchObject({
      schemaVersion: 2,
      content: [
        {
          attrs: {
            caption: "Estudantes durante a oficina.",
            credit: "Foto: Acervo NITE",
            layout: "full",
          },
        },
      ],
    });
  });

  it("resolve vídeo e WebVTT do body_media para o contrato público V3", () => {
    const videoMediaId = "30000000-0000-4000-8000-000000000301";
    const captionsMediaId = "30000000-0000-4000-8000-000000000302";
    const article = mapPublishedArticle(
      {
        ...row,
        contentSchemaVersion: 3,
        body: {
          schemaVersion: 3,
          type: "doc",
          content: [
            {
              type: "video",
              attrs: {
                mediaId: videoMediaId,
                captionsMediaId,
                playbackMode: "manual",
                layout: "wide",
              },
            },
          ],
        },
        bodyMedia: {
          [videoMediaId]: {
            mediaKind: "video",
            objectKey: "news/video editorial.mp4",
            mimeType: "video/mp4",
            width: 1920,
            height: 1080,
            durationMs: 42_500,
            videoCodec: "avc1.640028",
            hasAudio: true,
          },
          [captionsMediaId]: {
            mediaKind: "captions",
            objectKey: "news/video editorial.pt-BR.vtt",
            mimeType: "text/vtt",
          },
        },
      },
      "https://media.nite.test/public/",
    );

    expect(article.body).toEqual({
      schemaVersion: 3,
      type: "doc",
      content: [
        {
          type: "video",
          attrs: {
            mediaId: videoMediaId,
            captionsMediaId,
            playbackMode: "manual",
            layout: "wide",
            src: "https://media.nite.test/public/news/video%20editorial.mp4",
            width: 1920,
            height: 1080,
            durationSeconds: 42.5,
            mimeType: "video/mp4",
            captions: {
              src: "https://media.nite.test/public/news/video%20editorial.pt-BR.vtt",
              mimeType: "text/vtt",
              srclang: "pt-BR",
              label: "Português",
            },
          },
        },
      ],
    });
  });
});
