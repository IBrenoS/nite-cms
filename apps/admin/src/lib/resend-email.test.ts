import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import {
  cmsMembershipInvitations,
  cmsMemberships,
  emailDeliveries,
  outboxEvents,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";
import {
  createResendInvitationEmailProvider,
  dispatchMembershipInvitationEmail,
  InvitationEmailProviderError,
  type InvitationEmailProvider,
} from "./resend-email";

const resendMocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendMocks.send };
  },
}));

const migrationsFolder = path.resolve(
  process.cwd(),
  "../../packages/db/drizzle",
);
const providerInput = {
  from: "CMS NITE <acesso@notify.nite.tec.br>",
  to: "pessoa@unijorge.com.br",
  subject: "Convite para integrar a equipe do CMS NITE",
  text: "Mensagem em texto puro",
  tags: [{ name: "delivery_id", value: "delivery-1" }],
};

describe("adaptador Resend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envia somente texto com tag e chave idempotente", async () => {
    resendMocks.send.mockResolvedValue({
      data: { id: "provider-message-id" },
      error: null,
    });
    const provider = createResendInvitationEmailProvider("re_test_key");

    await expect(
      provider.send(providerInput, {
        idempotencyKey: "membership-invitation/outbox-1",
      }),
    ).resolves.toEqual({ id: "provider-message-id" });
    expect(resendMocks.send).toHaveBeenCalledWith(providerInput, {
      idempotencyKey: "membership-invitation/outbox-1",
    });
    expect(resendMocks.send.mock.calls[0]?.[0]).not.toHaveProperty("html");
  });

  it.each([429, 500, 503])(
    "classifica HTTP %s como transitório",
    async (statusCode) => {
      resendMocks.send.mockResolvedValue({
        data: null,
        error: { statusCode, name: "rate_limit_exceeded", message: "detalhe" },
      });
      const provider = createResendInvitationEmailProvider("re_test_key");

      await expect(
        provider.send(providerInput, { idempotencyKey: "key" }),
      ).rejects.toMatchObject({ transient: true });
    },
  );

  it("classifica timeout como transitório e 4xx como permanente", async () => {
    const provider = createResendInvitationEmailProvider("re_test_key");
    resendMocks.send.mockRejectedValueOnce(new Error("network timeout"));
    await expect(
      provider.send(providerInput, { idempotencyKey: "key" }),
    ).rejects.toMatchObject({ transient: true });

    resendMocks.send.mockResolvedValueOnce({
      data: null,
      error: { statusCode: 403, name: "validation_error", message: "secret" },
    });
    await expect(
      provider.send(providerInput, { idempotencyKey: "key" }),
    ).rejects.toMatchObject({
      transient: false,
      failureReason: "Resend rejeitou o envio (HTTP 403).",
    });
  });
});

describe("dispatcher de convite", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  async function arrange() {
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
        expiresAt: new Date("2026-10-09T12:00:00.000Z"),
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

  function options(
    arranged: Awaited<ReturnType<typeof arrange>>,
    provider: InvitationEmailProvider,
  ) {
    return {
      ...arranged,
      outboxEventId: arranged.outboxEvent.id,
      invitationId: arranged.invitation.id,
      provider,
      configuration: {
        fromEmail: "CMS NITE <acesso@notify.nite.tec.br>",
        publicUrl: "https://cms.nite.test",
        invitationLinkSecret: "convite-secreto-com-pelo-menos-32-bytes",
      },
      now: new Date("2026-10-02T12:00:00.000Z"),
    };
  }

  it("persiste antes de enviar e mantém chave, tag e payload no retry", async () => {
    const arranged = await arrange();
    const provider: InvitationEmailProvider = {
      send: vi.fn().mockResolvedValue({ id: "provider-message-id" }),
    };
    await client.exec(`
      create function reject_provider_message_update() returns trigger as $$
      begin
        if new.provider_message_id is not null then
          raise exception 'falha local simulada';
        end if;
        return new;
      end;
      $$ language plpgsql;
      create trigger reject_provider_message_update_trigger
      before update on email_deliveries
      for each row execute function reject_provider_message_update();
    `);

    await expect(
      dispatchMembershipInvitationEmail(options(arranged, provider)),
    ).rejects.toThrow();
    await client.exec(
      `drop trigger reject_provider_message_update_trigger on email_deliveries`,
    );
    await expect(
      dispatchMembershipInvitationEmail(options(arranged, provider)),
    ).resolves.toMatchObject({ status: "sent" });

    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(vi.mocked(provider.send).mock.calls[1]).toEqual(
      vi.mocked(provider.send).mock.calls[0],
    );
    const [request, requestOptions] = vi.mocked(provider.send).mock.calls[0]!;
    const [delivery] = await arranged.database.select().from(emailDeliveries);
    expect(request.tags).toEqual([{ name: "delivery_id", value: delivery.id }]);
    expect(requestOptions.idempotencyKey).toBe(
      `membership-invitation/${arranged.outboxEvent.id}`,
    );
    expect(request).not.toHaveProperty("html");
  });

  it("encerra falha permanente sem solicitar retry da outbox", async () => {
    const permanent = await arrange();
    const permanentProvider: InvitationEmailProvider = {
      send: vi
        .fn()
        .mockRejectedValue(
          new InvitationEmailProviderError(
            false,
            "Resend rejeitou o envio (HTTP 403).",
          ),
        ),
    };
    await expect(
      dispatchMembershipInvitationEmail(options(permanent, permanentProvider)),
    ).resolves.toMatchObject({ status: "failed" });
    await expect(
      permanent.database.select().from(emailDeliveries),
    ).resolves.toMatchObject([
      {
        status: "failed",
        failureReason: "Resend rejeitou o envio (HTTP 403).",
      },
    ]);
  });

  it("mantém entrega pendente e relança falha transitória", async () => {
    const arranged = await arrange();
    const provider: InvitationEmailProvider = {
      send: vi
        .fn()
        .mockRejectedValue(
          new InvitationEmailProviderError(
            true,
            "Resend indisponível temporariamente.",
          ),
        ),
    };

    await expect(
      dispatchMembershipInvitationEmail(options(arranged, provider)),
    ).rejects.toMatchObject({ transient: true });
    await expect(
      arranged.database.select().from(emailDeliveries),
    ).resolves.toMatchObject([{ status: "pending", failureReason: null }]);
  });

  it("encerra sem envio quando o convite não está mais pendente", async () => {
    const arranged = await arrange();
    await arranged.database
      .update(cmsMembershipInvitations)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(cmsMembershipInvitations.id, arranged.invitation.id));
    const provider: InvitationEmailProvider = {
      send: vi.fn(),
    };

    await expect(
      dispatchMembershipInvitationEmail(options(arranged, provider)),
    ).resolves.toEqual({ status: "skipped" });
    expect(provider.send).not.toHaveBeenCalled();
    await expect(
      arranged.database.select().from(emailDeliveries),
    ).resolves.toEqual([]);
  });
});
