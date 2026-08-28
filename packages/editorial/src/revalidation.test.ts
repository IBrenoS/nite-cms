import { describe, expect, it } from "vitest";

import { newsRevalidationPayloadSchema } from "./revalidation";

describe("contrato de revalidação de notícias", () => {
  it("aceita eventos aditivos de publicação e retirada pública com slug e categoria", () => {
    const basePayload = {
      eventId: "40000000-0000-4000-8000-000000000001",
      articleId: "10000000-0000-4000-8000-000000000001",
      revisionId: "20000000-0000-4000-8000-000000000001",
      slug: "materia-publicada",
      category: "inovacao",
    };

    for (const topic of [
      "news.article.published",
      "news.article.unpublished",
      "news.article.archived",
    ]) {
      expect(
        newsRevalidationPayloadSchema.safeParse({ ...basePayload, topic })
          .success,
      ).toBe(true);
    }
    expect(
      newsRevalidationPayloadSchema.safeParse({
        ...basePayload,
        topic: "news.article.deleted",
      }).success,
    ).toBe(false);
  });
});
