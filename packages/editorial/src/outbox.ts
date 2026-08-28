import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { type CmsDatabase } from "./identity";
import { outboxEvents, type OutboxEvent } from "@nite/cms-db";

export type OutboxMessage = Pick<
  OutboxEvent,
  "id" | "topic" | "aggregateId" | "payload" | "attempts"
>;

export interface OutboxDispatcher {
  dispatch(message: OutboxMessage): Promise<void>;
}

const processingOptionsSchema = z.object({
  batchSize: z.number().int().min(1).max(50).default(10),
  maxAttempts: z.number().int().min(1).max(20).default(8),
  lockTimeoutMs: z.number().int().min(60_000).max(3_600_000).default(900_000),
});

function sanitizeOutboxError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  return message.replaceAll(/\s+/g, " ").trim().slice(0, 500);
}

function retryDelayMs(attempts: number) {
  return Math.min(86_400_000, 60_000 * 2 ** Math.max(0, attempts - 1));
}

function hasLockToken(
  event: OutboxEvent,
): event is OutboxEvent & { lockToken: string } {
  return event.lockToken !== null;
}

async function claimOutboxEvents<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  input: {
    now: Date;
    batchSize: number;
    maxAttempts: number;
    lockTimeoutMs: number;
  },
) {
  const staleBefore = new Date(input.now.getTime() - input.lockTimeoutMs);
  const lockToken = randomUUID();

  return database.transaction(async (transaction) => {
    await transaction
      .update(outboxEvents)
      .set({
        status: "failed",
        lockedAt: null,
        lockToken: null,
        lastError: "Limite de tentativas atingido após expiração do claim.",
      })
      .where(
        and(
          eq(outboxEvents.status, "processing"),
          or(
            isNull(outboxEvents.lockedAt),
            lte(outboxEvents.lockedAt, staleBefore),
          ),
          sql`${outboxEvents.attempts} >= ${input.maxAttempts}`,
        ),
      );

    const candidates = await transaction
      .select({ id: outboxEvents.id })
      .from(outboxEvents)
      .where(
        and(
          lt(outboxEvents.attempts, input.maxAttempts),
          or(
            and(
              inArray(outboxEvents.status, ["pending", "failed"]),
              lte(outboxEvents.nextAttemptAt, input.now),
            ),
            and(
              eq(outboxEvents.status, "processing"),
              or(
                isNull(outboxEvents.lockedAt),
                lte(outboxEvents.lockedAt, staleBefore),
              ),
            ),
          ),
        ),
      )
      .orderBy(outboxEvents.createdAt)
      .limit(input.batchSize)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) return [];

    const claimed = await transaction
      .update(outboxEvents)
      .set({
        status: "processing",
        attempts: sql`${outboxEvents.attempts} + 1`,
        lockedAt: input.now,
        lockToken,
        lastError: null,
      })
      .where(
        and(
          inArray(
            outboxEvents.id,
            candidates.map(({ id }) => id),
          ),
          lt(outboxEvents.attempts, input.maxAttempts),
        ),
      )
      .returning();

    return claimed.filter(hasLockToken);
  });
}

export async function processOutboxEvents<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  dispatcher: OutboxDispatcher,
  rawOptions: {
    now?: () => Date;
    batchSize?: number;
    maxAttempts?: number;
    lockTimeoutMs?: number;
  } = {},
) {
  const options = processingOptionsSchema.parse(rawOptions);
  const now = rawOptions.now?.() ?? new Date();
  const claimed = await claimOutboxEvents(database, {
    now,
    batchSize: options.batchSize,
    maxAttempts: options.maxAttempts,
    lockTimeoutMs: options.lockTimeoutMs,
  });
  let succeeded = 0;
  let failed = 0;

  for (const event of claimed) {
    try {
      await dispatcher.dispatch(event);
      const completed = await database
        .update(outboxEvents)
        .set({
          status: "succeeded",
          processedAt: now,
          lockedAt: null,
          lockToken: null,
          lastError: null,
        })
        .where(
          and(
            eq(outboxEvents.id, event.id),
            eq(outboxEvents.status, "processing"),
            eq(outboxEvents.lockToken, event.lockToken),
          ),
        )
        .returning({ id: outboxEvents.id });
      succeeded += completed.length;
    } catch (error) {
      const retryAt = new Date(now.getTime() + retryDelayMs(event.attempts));
      const completed = await database
        .update(outboxEvents)
        .set({
          status: "failed",
          nextAttemptAt: retryAt,
          lockedAt: null,
          lockToken: null,
          lastError: sanitizeOutboxError(error),
        })
        .where(
          and(
            eq(outboxEvents.id, event.id),
            eq(outboxEvents.status, "processing"),
            eq(outboxEvents.lockToken, event.lockToken),
          ),
        )
        .returning({ id: outboxEvents.id });
      failed += completed.length;
    }
  }

  return { claimed: claimed.length, succeeded, failed };
}
