import { eq, sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  emailDeliveries,
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
