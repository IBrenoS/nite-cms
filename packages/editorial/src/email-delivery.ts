import { eq, sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  emailDeliveries,
  emailDeliveryEvents,
  type EmailDelivery,
} from "@nite/cms-db";
import type { CmsDatabase } from "./identity";

export async function getOrCreateInvitationEmailDelivery<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  input: {
    outboxEventId: string;
    invitationId: string;
    recipientEmail: string;
  },
): Promise<EmailDelivery> {
  await database
    .insert(emailDeliveries)
    .values(input)
    .onConflictDoNothing({ target: emailDeliveries.outboxEventId });
  const [delivery] = await database
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.outboxEventId, input.outboxEventId))
    .limit(1);
  if (!delivery || delivery.invitationId !== input.invitationId) {
    throw new Error("Entrega do convite indisponível.");
  }
  return delivery;
}

export async function markInvitationEmailDeliverySent<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  deliveryId: string,
  providerMessageId: string,
): Promise<EmailDelivery> {
  const [delivery] = await database
    .update(emailDeliveries)
    .set({
      providerMessageId,
      status: sql<EmailDelivery["status"]>`case
        when ${emailDeliveries.status} = 'pending'
          then 'sent'::email_delivery_status
        else ${emailDeliveries.status}
      end`,
      failureReason: null,
      updatedAt: new Date(),
    })
    .where(eq(emailDeliveries.id, deliveryId))
    .returning();
  if (!delivery) throw new Error("Entrega do convite não encontrada.");
  return delivery;
}

export async function markInvitationEmailDeliveryFailed<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  deliveryId: string,
  failureReason: string,
): Promise<EmailDelivery> {
  const [delivery] = await database
    .update(emailDeliveries)
    .set({
      status: sql<EmailDelivery["status"]>`case
        when ${emailDeliveries.status} in ('pending', 'sent')
          then 'failed'::email_delivery_status
        else ${emailDeliveries.status}
      end`,
      failureReason: sql<string | null>`case
        when ${emailDeliveries.status} in ('pending', 'sent')
          then ${failureReason}
        else ${emailDeliveries.failureReason}
      end`,
      updatedAt: new Date(),
    })
    .where(eq(emailDeliveries.id, deliveryId))
    .returning();
  if (!delivery) throw new Error("Entrega do convite não encontrada.");
  return delivery;
}

export type EmailDeliveryProviderEventType =
  | "email.sent"
  | "email.delivered"
  | "email.bounced"
  | "email.complained"
  | "email.failed"
  | "email.suppressed";

export type EmailDeliveryProviderEvent = {
  providerEventId: string;
  providerEventType: EmailDeliveryProviderEventType;
  providerCreatedAt: Date;
  deliveryId?: string;
  providerMessageId?: string;
  failureReason?: string;
};

function statusForProviderEvent(
  eventType: EmailDeliveryProviderEventType,
): EmailDelivery["status"] {
  switch (eventType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.failed":
    case "email.suppressed":
      return "failed";
  }
}

function canTransitionDeliveryStatus(
  current: EmailDelivery["status"],
  next: EmailDelivery["status"],
) {
  if (current === next) return true;
  if (current === "pending") return true;
  if (current === "sent") return next !== "pending";
  return current === "delivered" && next === "complained";
}

function sanitizeProviderFailureReason(reason: string | undefined) {
  if (!reason) return null;
  const normalized = reason.replace(/[\u0000-\u001f\u007f]+/gu, " ").trim();
  return normalized ? normalized.slice(0, 300) : null;
}

export async function recordEmailDeliveryEvent<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  event: EmailDeliveryProviderEvent,
): Promise<"recorded" | "duplicate" | "unmatched"> {
  return database.transaction(async (transaction) => {
    let delivery: EmailDelivery | undefined;
    if (event.deliveryId) {
      [delivery] = await transaction
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.id, event.deliveryId))
        .limit(1)
        .for("update");
    }
    if (!delivery && event.providerMessageId) {
      [delivery] = await transaction
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.providerMessageId, event.providerMessageId))
        .limit(1)
        .for("update");
    }
    if (!delivery) return "unmatched" as const;

    const failureReason = sanitizeProviderFailureReason(event.failureReason);
    const [insertedEvent] = await transaction
      .insert(emailDeliveryEvents)
      .values({
        providerEventId: event.providerEventId,
        deliveryId: delivery.id,
        providerEventType: event.providerEventType,
        providerCreatedAt: event.providerCreatedAt,
        failureReason,
      })
      .onConflictDoNothing({
        target: emailDeliveryEvents.providerEventId,
      })
      .returning({ id: emailDeliveryEvents.id });
    if (!insertedEvent) return "duplicate" as const;

    const nextStatus = statusForProviderEvent(event.providerEventType);
    const eventIsCurrent =
      !delivery.lastProviderEventAt ||
      event.providerCreatedAt >= delivery.lastProviderEventAt;
    const applyState =
      eventIsCurrent &&
      canTransitionDeliveryStatus(delivery.status, nextStatus);
    await transaction
      .update(emailDeliveries)
      .set({
        providerMessageId:
          delivery.providerMessageId ?? event.providerMessageId ?? null,
        status: applyState ? nextStatus : delivery.status,
        lastProviderEventAt: applyState
          ? event.providerCreatedAt
          : delivery.lastProviderEventAt,
        failureReason: applyState ? failureReason : delivery.failureReason,
        updatedAt: new Date(),
      })
      .where(eq(emailDeliveries.id, delivery.id));
    return "recorded" as const;
  });
}
