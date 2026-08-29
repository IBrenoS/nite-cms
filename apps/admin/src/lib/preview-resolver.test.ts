import { describe, expect, it } from "vitest";

import {
  previewArticleDtoSchema,
  resolvePreviewRequest,
} from "./preview-resolver";

const articleId = "10000000-0000-4000-8000-000000000001";
const revisionId = "20000000-0000-4000-8000-000000000001";
const mediaId = "30000000-0000-4000-8000-000000000001";

describe("resolução do preview privado", () => {
  it("deduplica a mídia usada como capa e inline e retorna DTO validado", async () => {
    let requestedMediaIds: string[] = [];
    const response = await resolvePreviewRequest(
      new Request("https://cms.test/api/preview/resolve"),
      {
        getClaims: () => ({ articleId, revisionId }),
        findRevision: async () => ({
          article: { id: articleId, slug: "preview-privado" },
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
      cover: { src: "https://media.nite.test/news/cover.webp" },
    });
  });

  it("não responde um envelope editorial que não passa no contrato público", async () => {
    const response = await resolvePreviewRequest(
      new Request("https://cms.test/api/preview/resolve"),
      {
        getClaims: () => ({ articleId, revisionId }),
        findRevision: async () => ({
          article: { id: articleId, slug: "preview-privado" },
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
});
