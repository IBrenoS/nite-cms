import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import { processOutboxEvents, type OutboxDispatcher } from "@nite/editorial";
import { outboxEvents } from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);

describe("processamento do outbox", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("entrega um evento uma vez e registra a conclusao", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [event] = await database
      .insert(outboxEvents)
      .values({
        topic: "news.article.published",
        aggregateId: "10000000-0000-4000-8000-000000000001",
        nextAttemptAt: new Date("2026-08-27T19:59:00.000Z"),
        payload: {
          articleId: "10000000-0000-4000-8000-000000000001",
          revisionId: "20000000-0000-4000-8000-000000000001",
          slug: "materia-publicada",
        },
      })
      .returning();
    const delivered: string[] = [];
    const dispatcher: OutboxDispatcher = {
      async dispatch(message) {
        delivered.push(message.id);
      },
    };

    await expect(
      processOutboxEvents(database, dispatcher, {
        now: () => new Date("2026-08-27T20:00:00.000Z"),
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(delivered).toEqual([event.id]);
    await expect(
      database.select().from(outboxEvents).where(eq(outboxEvents.id, event.id)),
    ).resolves.toMatchObject([
      {
        status: "succeeded",
        attempts: 1,
        lastError: null,
        processedAt: new Date("2026-08-27T20:00:00.000Z"),
      },
    ]);
  });

  it("agenda retry com backoff e conclui na tentativa seguinte", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [event] = await database
      .insert(outboxEvents)
      .values({
        topic: "news.article.published",
        nextAttemptAt: new Date("2026-08-27T19:59:00.000Z"),
        payload: {
          articleId: "10000000-0000-4000-8000-000000000001",
          revisionId: "20000000-0000-4000-8000-000000000001",
          slug: "materia-publicada",
        },
      })
      .returning();
    let shouldFail = true;
    const dispatcher: OutboxDispatcher = {
      async dispatch() {
        if (shouldFail) throw new Error("indisponibilidade temporaria");
      },
    };

    await expect(
      processOutboxEvents(database, dispatcher, {
        now: () => new Date("2026-08-27T20:00:00.000Z"),
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 0, failed: 1 });
    await expect(
      database.select().from(outboxEvents).where(eq(outboxEvents.id, event.id)),
    ).resolves.toMatchObject([
      {
        status: "failed",
        attempts: 1,
        nextAttemptAt: new Date("2026-08-27T20:01:00.000Z"),
        lastError: "indisponibilidade temporaria",
      },
    ]);

    shouldFail = false;
    await expect(
      processOutboxEvents(database, dispatcher, {
        now: () => new Date("2026-08-27T20:01:01.000Z"),
      }),
    ).resolves.toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    await expect(
      database.select().from(outboxEvents).where(eq(outboxEvents.id, event.id)),
    ).resolves.toMatchObject([{ status: "succeeded", attempts: 2 }]);
  });

  it("nao permite que dois workers entreguem o mesmo claim ativo", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    await database.insert(outboxEvents).values({
      topic: "news.article.published",
      nextAttemptAt: new Date("2026-08-27T19:59:00.000Z"),
      payload: {
        articleId: "10000000-0000-4000-8000-000000000001",
        revisionId: "20000000-0000-4000-8000-000000000001",
        slug: "materia-publicada",
      },
    });
    let releaseDelivery: (() => void) | undefined;
    const deliveryStarted = new Promise<void>((resolve) => {
      releaseDelivery = resolve;
    });
    let dispatchCount = 0;
    const dispatcher: OutboxDispatcher = {
      async dispatch() {
        dispatchCount += 1;
        await deliveryStarted;
      },
    };
    const now = () => new Date("2026-08-27T20:00:00.000Z");

    const firstWorker = processOutboxEvents(database, dispatcher, { now });
    while (dispatchCount === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await expect(
      processOutboxEvents(database, dispatcher, { now }),
    ).resolves.toEqual({ claimed: 0, succeeded: 0, failed: 0 });
    releaseDelivery?.();
    await firstWorker;

    expect(dispatchCount).toBe(1);
  });

  it("encerra um claim orfao que ja atingiu o limite de tentativas", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [event] = await database
      .insert(outboxEvents)
      .values({
        topic: "news.article.published",
        status: "processing",
        attempts: 8,
        lockedAt: null,
        lockToken: null,
        nextAttemptAt: new Date("2026-08-27T19:59:00.000Z"),
        payload: {
          articleId: "10000000-0000-4000-8000-000000000001",
          revisionId: "20000000-0000-4000-8000-000000000001",
          slug: "materia-publicada",
        },
      })
      .returning();

    await expect(
      processOutboxEvents(
        database,
        { async dispatch() {} },
        { now: () => new Date("2026-08-27T20:00:00.000Z") },
      ),
    ).resolves.toEqual({ claimed: 0, succeeded: 0, failed: 0 });
    await expect(
      database.select().from(outboxEvents).where(eq(outboxEvents.id, event.id)),
    ).resolves.toMatchObject([
      {
        status: "failed",
        lastError: "Limite de tentativas atingido após expiração do claim.",
      },
    ]);
  });
});
