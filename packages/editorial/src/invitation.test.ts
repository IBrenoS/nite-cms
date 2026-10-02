import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import * as editorial from "@nite/editorial";
import {
  auditEvents,
  cmsMembershipInvitations,
  cmsMemberships,
  outboxEvents,
  type CmsMembershipInvitation,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);
const tenantId = "10000000-0000-4000-8000-000000000001";

type DomainCommand = (...arguments_: readonly unknown[]) => unknown;

function command(name: string): DomainCommand {
  const candidate: unknown = Reflect.get(editorial, name);
  expect(candidate, `export ${name}`).toBeTypeOf("function");
  if (typeof candidate !== "function")
    throw new Error(`export ${name} ausente`);
  return (...arguments_) => Reflect.apply(candidate, undefined, arguments_);
}

describe("convites de acesso editorial", () => {
  let client: PGlite;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T12:00:00.000Z"));
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await client.close();
  });

  it("normaliza somente emails do dominio institucional", () => {
    const normalize = command("normalizeCmsInvitationEmail");
    expect(normalize("  Pessoa.Teste+nite@UniJorge.com ")).toBe(
      "pessoa.teste+nite@unijorge.com",
    );
    expect(normalize("  Matricula@UniJorge.com.br ")).toBe(
      "matricula@unijorge.com.br",
    );
    expect(() => normalize("pessoa@outro.example")).toThrow();
    expect(() => normalize("pessoa@@unijorge.com")).toThrow();
  });

  it("permite que admin crie convite e bloqueia duplicidade e publisher", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin, publisher] = await database
      .insert(cmsMemberships)
      .values([
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000001",
          displayName: "Admin NITE",
          email: "admin@unijorge.com",
          role: "admin",
        },
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000002",
          displayName: "Pessoa editorial",
          email: "editorial@unijorge.com",
          role: "publisher",
        },
      ])
      .returning();
    const create = command("createCmsMembershipInvitation");

    const invitation = (await Reflect.apply(create, undefined, [
      database,
      {
        actor: admin,
        email: "  NOVA@UniJorge.com.br ",
        role: "publisher",
      },
    ])) as CmsMembershipInvitation;
    expect(invitation).toMatchObject({
      tenantId,
      email: "nova@unijorge.com.br",
      role: "publisher",
      status: "pending",
      expiresAt: new Date("2026-09-14T12:00:00.000Z"),
    });

    await expect(
      Reflect.apply(create, undefined, [
        database,
        {
          actor: admin,
          email: "nova@unijorge.com.br",
          role: "admin",
        },
      ]),
    ).rejects.toThrow();
    await expect(
      Reflect.apply(create, undefined, [
        database,
        {
          actor: publisher,
          email: "bloqueada@unijorge.com",
          role: "publisher",
        },
      ]),
    ).rejects.toThrow();
    await expect(
      database.select().from(cmsMembershipInvitations),
    ).resolves.toHaveLength(1);
    await expect(database.select().from(auditEvents)).resolves.toMatchObject([
      { action: "membership.invitation.created", actorMembershipId: admin.id },
    ]);
    await expect(database.select().from(outboxEvents)).resolves.toMatchObject([
      {
        topic: "membership.invitation.email.requested",
        aggregateId: invitation.id,
        payload: { invitationId: invitation.id },
      },
    ]);
  });

  it("substitui e revoga convites sem alterar o historico", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: "20000000-0000-4000-8000-000000000001",
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();
    const create = command("createCmsMembershipInvitation");
    const replace = command("replaceCmsMembershipInvitation");
    const revoke = command("revokeCmsMembershipInvitation");
    const original = (await Reflect.apply(create, undefined, [
      database,
      {
        actor: admin,
        email: "errado@unijorge.com",
        role: "publisher",
      },
    ])) as CmsMembershipInvitation;

    const replacement = (await Reflect.apply(replace, undefined, [
      database,
      {
        actor: admin,
        invitationId: original.id,
        email: "correto@unijorge.com",
        role: "admin",
      },
    ])) as CmsMembershipInvitation;
    expect(replacement).toMatchObject({
      email: "correto@unijorge.com",
      role: "admin",
      status: "pending",
      replacesInvitationId: original.id,
    });
    await Reflect.apply(revoke, undefined, [
      database,
      {
        actor: admin,
        invitationId: replacement.id,
      },
    ]);
    await expect(
      Reflect.apply(revoke, undefined, [
        database,
        { actor: admin, invitationId: replacement.id },
      ]),
    ).rejects.toThrow();

    await expect(
      database.select().from(cmsMembershipInvitations),
    ).resolves.toMatchObject([
      { id: original.id, status: "revoked", revokedAt: expect.any(Date) },
      { id: replacement.id, status: "revoked", revokedAt: expect.any(Date) },
    ]);
    await expect(database.select().from(auditEvents)).resolves.toMatchObject([
      { action: "membership.invitation.created" },
      { action: "membership.invitation.revoked" },
      { action: "membership.invitation.created" },
      { action: "membership.invitation.revoked" },
    ]);
    await expect(database.select().from(outboxEvents)).resolves.toMatchObject([
      {
        topic: "membership.invitation.email.requested",
        aggregateId: original.id,
        payload: { invitationId: original.id },
      },
      {
        topic: "membership.invitation.email.requested",
        aggregateId: replacement.id,
        payload: { invitationId: replacement.id },
      },
    ]);
  });

  it("reverte convite e auditoria quando a outbox rejeita o evento", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: "20000000-0000-4000-8000-000000000003",
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();
    await client.exec(`
      create function reject_invitation_outbox() returns trigger as $$
      begin
        if new.topic = 'membership.invitation.email.requested' then
          raise exception 'falha de outbox simulada';
        end if;
        return new;
      end;
      $$ language plpgsql;
      create trigger reject_invitation_outbox_trigger
      before insert on outbox_events
      for each row execute function reject_invitation_outbox();
    `);

    await expect(
      Reflect.apply(command("createCmsMembershipInvitation"), undefined, [
        database,
        {
          actor: admin,
          email: "rollback@unijorge.com.br",
          role: "publisher",
        },
      ]),
    ).rejects.toThrow();

    await expect(
      database.select().from(cmsMembershipInvitations),
    ).resolves.toEqual([]);
    await expect(database.select().from(auditEvents)).resolves.toEqual([]);
    await expect(database.select().from(outboxEvents)).resolves.toEqual([]);
  });
});
