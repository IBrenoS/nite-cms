import { describe, expect, it } from "vitest";

import { verifyRevalidationSignature } from "@nite/editorial/revalidation";
import {
  createWebRevalidationDispatcher,
  readOutboxConfiguration,
  verifyCronAuthorization,
} from "./outbox-protocol";

const message = {
  id: "40000000-0000-4000-8000-000000000001",
  topic: "news.article.published",
  aggregateId: "10000000-0000-4000-8000-000000000001",
  attempts: 1,
  payload: {
    articleId: "10000000-0000-4000-8000-000000000001",
    revisionId: "20000000-0000-4000-8000-000000000001",
    slug: "materia-publicada",
  },
};

describe("dispatcher do outbox", () => {
  it("envia somente o payload validado com assinatura e timestamp", async () => {
    let receivedUrl = "";
    let receivedInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      receivedUrl = input.toString();
      receivedInit = init;
      return new Response(null, { status: 204 });
    };
    const secret = "segredo-de-revalidacao-com-32-caracteres";
    const dispatcher = createWebRevalidationDispatcher({
      endpointUrl: "https://nite.test/api/revalidate/news",
      secret,
      fetcher,
      now: () => new Date("2026-08-27T20:00:00.000Z"),
    });

    await dispatcher.dispatch(message);

    const headers = new Headers(receivedInit?.headers);
    const body = receivedInit?.body?.toString() ?? "";
    expect(receivedUrl).toBe("https://nite.test/api/revalidate/news");
    expect(receivedInit).toMatchObject({ method: "POST", redirect: "error" });
    expect(JSON.parse(body)).toEqual({
      eventId: message.id,
      topic: message.topic,
      ...message.payload,
    });
    expect(headers.get("content-type")).toBe("application/json");
    expect(
      verifyRevalidationSignature({
        body,
        timestamp: headers.get("x-nite-timestamp") ?? "",
        signature: headers.get("x-nite-signature") ?? "",
        secret,
        now: new Date("2026-08-27T20:00:30.000Z"),
      }),
    ).toBe(true);
  });

  it("falha fechado para configuracao incompleta e resposta nao bem-sucedida", async () => {
    expect(readOutboxConfiguration({})).toEqual({
      configured: false,
      missing: [
        "DATABASE_ADMIN_URL",
        "WEB_REVALIDATION_URL",
        "REVALIDATION_SECRET",
      ],
    });
    const dispatcher = createWebRevalidationDispatcher({
      endpointUrl: "https://nite.test/api/revalidate/news",
      secret: "segredo-de-revalidacao-com-32-caracteres",
      fetcher: async () => new Response(null, { status: 503 }),
    });

    await expect(dispatcher.dispatch(message)).rejects.toThrow(
      "Portal recusou a revalidação (503).",
    );
  });

  it("valida o bearer do cron sem aceitar variantes", () => {
    const secret = "segredo-do-cron-com-pelo-menos-32-caracteres";

    expect(verifyCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyCronAuthorization(`bearer ${secret}`, secret)).toBe(false);
    expect(verifyCronAuthorization("Bearer segredo-incorreto", secret)).toBe(
      false,
    );
    expect(verifyCronAuthorization(null, secret)).toBe(false);
  });
});
