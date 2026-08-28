import { describe, expect, it } from "vitest";

import type { NewsArticle } from "@nite/editorial";
import {
  createArticleResponse,
  createListResponse,
  PUBLIC_NEWS_CACHE_CONTROL,
} from "./responses";

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
  body: [
    {
      type: "paragraph",
      text: "Texto editorial suficientemente longo para validar o contrato público.",
    },
  ],
} satisfies NewsArticle;

describe("respostas HTTP públicas de News", () => {
  it("versiona, cacheia e assina a coleção com ETag", async () => {
    const response = createListResponse([article]);

    await expect(response.json()).resolves.toEqual({
      version: 1,
      articles: [article],
    });
    expect(response.headers.get("cache-control")).toBe(
      PUBLIC_NEWS_CACHE_CONTROL,
    );
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
    await expect(missing.json()).resolves.toEqual({ error: "not_found" });
  });
});
