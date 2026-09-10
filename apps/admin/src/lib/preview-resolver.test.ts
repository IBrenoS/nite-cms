import { describe, expect, it } from "vitest";

import {
  previewArticleDtoSchema,
  resolvePreviewRequest,
} from "./preview-resolver";

const articleId = "10000000-0000-4000-8000-000000000001";
const revisionId = "20000000-0000-4000-8000-000000000001";
const snapshotId = "40000000-0000-4000-8000-000000000001";
const mediaId = "30000000-0000-4000-8000-000000000001";

describe("resolução do preview privado", () => {
  it("resolve snapshot v2 com identidade própria e revisão-base", async () => {
    const response = await resolvePreviewRequest(
      new Request("https://cms.test/api/preview/resolve"),
      {
        getClaims: () => ({ articleId, snapshotId }),
        findRevision: async () => undefined,
        findSnapshot: async () => ({
          article: { id: articleId, publishedAt: null },
          snapshot: { id: snapshotId, baseRevisionId: revisionId },
          input: {
            slug: "slug-ainda-nao-salvo",
            title: "Título atual ainda não salvo como revisão",
            summary:
              "Resumo atual com conteúdo suficiente para o contrato editorial do preview privado.",
            category: "inovacao",
            byline: "Redação NITE",
            featured: false,
            coverMediaId: mediaId,
            coverAlt: "Equipe revisando a matéria antes da publicação.",
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
        }),
        findMedia: async () => [
          {
            id: mediaId,
            mediaKind: "image",
            status: "ready",
            publicObjectKey: "news/cover.webp",
            mimeType: "image/webp",
            width: 1200,
            height: 675,
          },
        ],
        getPublicMediaUrl: () => "https://media.nite.test/news/cover.webp",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      schemaVersion: 2,
      articleId,
      snapshotId,
      baseRevisionId: revisionId,
      slug: "slug-ainda-nao-salvo",
      title: "Título atual ainda não salvo como revisão",
    });
  });

  it("deduplica a mídia usada como capa e inline e retorna DTO validado", async () => {
    let requestedMediaIds: string[] = [];
    const response = await resolvePreviewRequest(
      new Request("https://cms.test/api/preview/resolve"),
      {
        getClaims: () => ({ articleId, revisionId }),
        findRevision: async () => ({
          article: {
            id: articleId,
            slug: "preview-privado",
            publishedAt: null,
          },
          revision: {
            id: revisionId,
            title: "Uma matéria privada para preview",
            summary:
              "Este resumo tem extensão suficiente para o contrato de preview privado.",
            category: "tecnologia",
            eventDate: null,
            readTimeMinutes: 2,
            byline: "Redação NITE",
            featured: false,
            coverMediaId: mediaId,
            coverAlt: "Equipe preparando uma apresentação editorial",
            coverCaption: "Equipe durante os preparativos.",
            coverCredit: "Foto: NITE",
            body: {
              schemaVersion: 1,
              type: "doc",
              content: [
                {
                  type: "image",
                  attrs: {
                    mediaId,
                    alt: "Equipe preparando uma apresentação editorial",
                  },
                },
              ],
            },
            seo: null,
          },
        }),
        findMedia: async (ids) => {
          requestedMediaIds = ids;
          return [
            {
              id: mediaId,
              mediaKind: "image",
              status: "ready",
              publicObjectKey: "news/cover.webp",
              mimeType: "image/webp",
              width: 1200,
              height: 675,
            },
          ];
        },
        getPublicMediaUrl: () => "https://media.nite.test/news/cover.webp",
      },
    );

    expect(requestedMediaIds).toEqual([mediaId]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(previewArticleDtoSchema.parse(await response.json())).toMatchObject({
      schemaVersion: 1,
      articleId,
      revisionId,
      publishedAt: null,
      cover: {
        src: "https://media.nite.test/news/cover.webp",
        caption: "Equipe durante os preparativos.",
        credit: "Foto: NITE",
      },
    });
  });

  it("não responde um envelope editorial que não passa no contrato público", async () => {
    const response = await resolvePreviewRequest(
      new Request("https://cms.test/api/preview/resolve"),
      {
        getClaims: () => ({ articleId, revisionId }),
        findRevision: async () => ({
          article: {
            id: articleId,
            slug: "preview-privado",
            publishedAt: new Date("2026-08-29T12:00:00.000Z"),
          },
          revision: {
            id: revisionId,
            title: "curto",
            summary:
              "Este resumo tem extensão suficiente para o contrato de preview privado.",
            category: "tecnologia",
            eventDate: null,
            readTimeMinutes: 2,
            byline: "Redação NITE",
            featured: false,
            coverMediaId: null,
            coverAlt: "Equipe preparando uma apresentação editorial",
            body: {
              schemaVersion: 1,
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Conteúdo." }],
                },
              ],
            },
            seo: null,
          },
        }),
        findMedia: async () => [],
        getPublicMediaUrl: () => undefined,
      },
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejeita preview quando a capa pronta não é uma imagem", async () => {
    const response = await resolvePreviewRequest(
      new Request("https://cms.test/api/preview/resolve"),
      {
        getClaims: () => ({ articleId, revisionId }),
        findRevision: async () => ({
          article: {
            id: articleId,
            slug: "preview-capa-incompativel",
            publishedAt: null,
          },
          revision: {
            id: revisionId,
            title: "Uma matéria privada para validar a capa",
            summary:
              "Este resumo tem extensão suficiente para validar o tipo da capa no preview.",
            category: "tecnologia",
            eventDate: null,
            readTimeMinutes: 1,
            byline: "Redação NITE",
            featured: false,
            coverMediaId: mediaId,
            coverAlt: "Equipe preparando uma apresentação editorial",
            body: {
              schemaVersion: 1,
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Conteúdo." }],
                },
              ],
            },
            seo: null,
          },
        }),
        findMedia: async () => [
          {
            id: mediaId,
            mediaKind: "video",
            status: "ready",
            publicObjectKey: "news/not-a-cover.mp4",
            mimeType: "video/mp4",
            width: 1920,
            height: 1080,
            durationMs: 10_000,
          },
        ],
        getPublicMediaUrl: () => "https://media.nite.test/news/not-a-cover.mp4",
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "media_not_ready",
    });
  });

  it("aceita somente publishedAt ISO datetime ou null no contrato versionado", () => {
    expect(
      previewArticleDtoSchema.parse({
        schemaVersion: 1,
        articleId,
        revisionId,
        slug: "preview-privado",
        title: "Uma matéria privada para preview",
        summary:
          "Este resumo tem extensão suficiente para o contrato de preview privado.",
        category: "tecnologia",
        publishedAt: "2026-08-29T12:00:00.000Z",
        readTimeMinutes: 2,
        byline: "Redação NITE",
        featured: false,
        body: {
          schemaVersion: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Conteúdo." }],
            },
          ],
        },
      }),
    ).toMatchObject({ publishedAt: "2026-08-29T12:00:00.000Z" });

    expect(() =>
      previewArticleDtoSchema.parse({
        schemaVersion: 1,
        articleId,
        revisionId,
        slug: "preview-privado",
        title: "Uma matéria privada para preview",
        summary:
          "Este resumo tem extensão suficiente para o contrato de preview privado.",
        category: "tecnologia",
        publishedAt: "2026-08-29",
        readTimeMinutes: 2,
        byline: "Redação NITE",
        featured: false,
        body: {
          schemaVersion: 1,
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Conteúdo." }],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("resolve vídeo e legenda do preview V3", async () => {
    const videoMediaId = "30000000-0000-4000-8000-000000000011";
    const captionsMediaId = "30000000-0000-4000-8000-000000000012";
    let requestedMediaIds: string[] = [];
    const response = await resolvePreviewRequest(
      new Request("https://cms.test/api/preview/resolve"),
      {
        getClaims: () => ({ articleId, revisionId }),
        findRevision: async () => ({
          article: {
            id: articleId,
            slug: "preview-video-v3",
            publishedAt: null,
          },
          revision: {
            id: revisionId,
            title: "Uma matéria privada com vídeo editorial",
            summary:
              "Este resumo tem extensão suficiente para validar o vídeo no preview privado.",
            category: "tecnologia",
            eventDate: null,
            readTimeMinutes: 1,
            byline: "Redação NITE",
            featured: false,
            coverMediaId: mediaId,
            coverAlt: "Equipe preparando uma apresentação editorial",
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
            seo: null,
          },
        }),
        findMedia: async (ids) => {
          requestedMediaIds = ids;
          return [
            {
              id: mediaId,
              mediaKind: "image",
              status: "ready",
              publicObjectKey: "news/cover.webp",
              mimeType: "image/webp",
              width: 1200,
              height: 675,
            },
            {
              id: videoMediaId,
              mediaKind: "video",
              status: "ready",
              publicObjectKey: "news/video.mp4",
              mimeType: "video/mp4",
              width: 1920,
              height: 1080,
              durationMs: 24_500,
            },
            {
              id: captionsMediaId,
              mediaKind: "captions",
              status: "ready",
              publicObjectKey: "news/video.pt-BR.vtt",
              mimeType: "text/vtt",
              width: null,
              height: null,
              durationMs: null,
            },
          ];
        },
        getPublicMediaUrl: (objectKey) =>
          `https://media.nite.test/${objectKey}`,
      },
    );

    expect(requestedMediaIds).toEqual([videoMediaId, captionsMediaId, mediaId]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      body: {
        schemaVersion: 3,
        content: [
          {
            type: "video",
            attrs: {
              src: "https://media.nite.test/news/video.mp4",
              durationSeconds: 24.5,
              mimeType: "video/mp4",
              captions: {
                src: "https://media.nite.test/news/video.pt-BR.vtt",
                mimeType: "text/vtt",
                srclang: "pt-BR",
                label: "Português",
              },
            },
          },
        ],
      },
    });
  });
});
