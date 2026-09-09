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
            status: "ready",
            publicObjectKey: "news/cover.webp",
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
              status: "ready",
              publicObjectKey: "news/cover.webp",
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
});
