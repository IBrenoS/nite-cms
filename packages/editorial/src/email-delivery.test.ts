import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  cmsMembershipInvitations,
  cmsMemberships,
  emailDeliveries,
  emailDeliveryEvents,
  outboxEvents,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";
import {
  getOrCreateInvitationEmailDelivery,
  markInvitationEmailDeliveryFailed,
  markInvitationEmailDeliverySent,
  recordEmailDeliveryEvent,
} from "./email-delivery";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);

describe("persistência de entrega de convite", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  async function arrangeDelivery() {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "10000000-0000-4000-8000-000000000001",
        objectId: "20000000-0000-4000-8000-000000000001",
        displayName: "Breno NITE",
        role: "admin",
      })
      .returning();
    const [invitation] = await database
      .insert(cmsMembershipInvitations)
      .values({
        tenantId: admin.tenantId,
        email: "pessoa@unijorge.com.br",
        role: "publisher",
        expiresAt: new Date(Date.now() + 60_000),
        invitedByMembershipId: admin.id,
      })
      .returning();
    const [outboxEvent] = await database
      .insert(outboxEvents)
      .values({
        topic: "membership.invitation.email.requested",
        aggregateId: invitation.id,
        payload: { invitationId: invitation.id },
      })
      .returning();
    return { database, invitation, outboxEvent };
  }

  it("cria uma única entrega estável por evento e convite", async () => {
    const { database, invitation, outboxEvent } = await arrangeDelivery();
    const input = {
      outboxEventId: outboxEvent.id,
      invitationId: invitation.id,
      recipientEmail: invitation.email,
    };

    const first = await getOrCreateInvitationEmailDelivery(database, input);
    const repeated = await getOrCreateInvitationEmailDelivery(database, input);

    expect(repeated).toEqual(first);
    expect(first).toMatchObject({
      status: "pending",
      provider: "resend",
      providerMessageId: null,
    });
    await expect(database.select().from(emailDeliveries)).resolves.toHaveLength(
      1,
    );
  });

  it("registra aceite do provedor sem regredir estado mais avançado", async () => {
    const { database, invitation, outboxEvent } = await arrangeDelivery();
    const delivery = await getOrCreateInvitationEmailDelivery(database, {
      outboxEventId: outboxEvent.id,
      invitationId: invitation.id,
      recipientEmail: invitation.email,
    });

    await database
      .update(emailDeliveries)
      .set({ status: "delivered" })
      .where(eq(emailDeliveries.id, delivery.id));
    const sent = await markInvitationEmailDeliverySent(
      database,
      delivery.id,
      "provider-message-id",
    );

    expect(sent).toMatchObject({
      status: "delivered",
      providerMessageId: "provider-message-id",
      failureReason: null,
    });
  });

  it("marca falha permanente com motivo sanitizado recebido", async () => {
    const { database, invitation, outboxEvent } = await arrangeDelivery();
    const delivery = await getOrCreateInvitationEmailDelivery(database, {
      outboxEventId: outboxEvent.id,
      invitationId: invitation.id,
      recipientEmail: invitation.email,
    });

    await expect(
      markInvitationEmailDeliveryFailed(
        database,
        delivery.id,
        "Provider rejected request.",
      ),
    ).resolves.toMatchObject({
      status: "failed",
      failureReason: "Provider rejected request.",
    });
  });

  it("correlaciona pela tag antes do provider id e ignora duplicidade", async () => {
    const { database, invitation, outboxEvent } = await arrangeDelivery();
    const delivery = await getOrCreateInvitationEmailDelivery(database, {
      outboxEventId: outboxEvent.id,
      invitationId: invitation.id,
      recipientEmail: invitation.email,
    });
    const event = {
      providerEventId: "evt_delivered_1",
      providerEventType: "email.delivered" as const,
      providerCreatedAt: new Date("2026-10-02T12:00:00.000Z"),
      deliveryId: delivery.id,
      providerMessageId: "provider-message-id",
    };

    await expect(recordEmailDeliveryEvent(database, event)).resolves.toBe(
      "recorded",
    );
    await expect(recordEmailDeliveryEvent(database, event)).resolves.toBe(
      "duplicate",
    );
    await expect(database.select().from(emailDeliveries)).resolves.toMatchObject([
      {
        id: delivery.id,
        status: "delivered",
        providerMessageId: "provider-message-id",
        lastProviderEventAt: event.providerCreatedAt,
      },
    ]);
    await expect(
      database.select().from(emailDeliveryEvents),
    ).resolves.toHaveLength(1);
  });

  it("registra evento fora de ordem sem regredir delivered para sent", async () => {
    const { database, invitation, outboxEvent } = await arrangeDelivery();
    const delivery = await getOrCreateInvitationEmailDelivery(database, {
      outboxEventId: outboxEvent.id,
      invitationId: invitation.id,
      recipientEmail: invitation.email,
    });
    await recordEmailDeliveryEvent(database, {
      providerEventId: "evt_delivered_2",
      providerEventType: "email.delivered",
      providerCreatedAt: new Date("2026-10-02T12:00:00.000Z"),
      deliveryId: delivery.id,
      providerMessageId: "provider-message-id",
    });

    await expect(
      recordEmailDeliveryEvent(database, {
        providerEventId: "evt_sent_older",
        providerEventType: "email.sent",
        providerCreatedAt: new Date("2026-10-02T11:59:00.000Z"),
        providerMessageId: "provider-message-id",
      }),
    ).resolves.toBe("recorded");

    await expect(database.select().from(emailDeliveries)).resolves.toMatchObject([
      {
        status: "delivered",
        lastProviderEventAt: new Date("2026-10-02T12:00:00.000Z"),
      },
    ]);
    await expect(
      database.select().from(emailDeliveryEvents),
    ).resolves.toHaveLength(2);
  });

  it("retorna unmatched sem registrar identificadores desconhecidos", async () => {
    const { database } = await arrangeDelivery();

    await expect(
      recordEmailDeliveryEvent(database, {
        providerEventId: "evt_unknown",
        providerEventType: "email.failed",
        providerCreatedAt: new Date("2026-10-02T12:00:00.000Z"),
        deliveryId: "50000000-0000-4000-8000-000000000001",
        providerMessageId: "unknown-provider-message",
        failureReason: "unknown recipient secret detail",
      }),
    ).resolves.toBe("unmatched");
    await expect(database.select().from(emailDeliveryEvents)).resolves.toEqual(
      [],
    );
  });
});
