import { describe, expect, it } from "vitest";

import type { NewsArticle } from "@nite/editorial";
import { createArticleResponse, createListResponse } from "./responses";

const article = {
  slug: "materia-publicada",
  title: "Matéria publicada pelo CMS NITE",
  summary:
    "Resumo editorial suficientemente descritivo para validar o contrato público da API.",
  category: "comunidade",
  publishedAt: "2026-08-27",
  readTimeMinutes: 4,
  byline: "Redação NITE",
  cover: {
    src: "https://media.nite.test/news/capa.webp",
    alt: "Pessoas reunidas em um ambiente universitário iluminado.",
  },
  featured: true,
  contentState: "real",
  public: true,
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
    ],
  },
} satisfies NewsArticle;

describe("respostas HTTP públicas de News", () => {
  it("versiona e impede cache da coleção publicada", async () => {
    const response = createListResponse([article]);

    await expect(response.json()).resolves.toEqual({
      version: 2,
      articles: [article],
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it("responde 304 quando o ETag coincide", () => {
    const initial = createListResponse([article]);
    const response = createListResponse(
      [article],
      initial.headers.get("etag") ?? undefined,
    );

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe(initial.headers.get("etag"));
  });

  it("distingue artigo ausente", async () => {
    const missing = createArticleResponse(undefined);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    await expect(missing.json()).resolves.toEqual({ error: "not_found" });
  });

  it("mantém o envelope v2 ao transportar body editorial V3 com vídeo", async () => {
    const videoArticle = {
      ...article,
      body: {
        schemaVersion: 3,
        type: "doc",
        content: [
          {
            type: "video",
            attrs: {
              mediaId: "30000000-0000-4000-8000-000000000301",
              playbackMode: "autoplay",
              layout: "wide",
              src: "https://media.nite.test/news/video.mp4",
              width: 1920,
              height: 1080,
              durationSeconds: 42.5,
              mimeType: "video/mp4",
            },
          },
        ],
      },
    } satisfies NewsArticle;

    const response = createArticleResponse(videoArticle);

    await expect(response.json()).resolves.toMatchObject({
      version: 2,
      article: { body: { schemaVersion: 3 } },
    });
  });
});
