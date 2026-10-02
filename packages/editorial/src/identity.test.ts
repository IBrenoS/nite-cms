import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import { CmsAuthorizationError, resolveCmsMembership } from "@nite/editorial";
import {
  auditEvents,
  cmsMembershipInvitations,
  cmsMemberships,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);
const tenantId = "10000000-0000-4000-8000-000000000001";
const adminObjectId = "20000000-0000-4000-8000-000000000001";

describe("identidade editorial Entra", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("faz bootstrap idempotente somente para o par tid + oid configurado", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const identity = {
      tenantId,
      objectId: adminObjectId,
      displayName: "Admin NITE",
      email: "admin@unijorge.com",
    };
    const bootstrap = {
      tenantId,
      adminObjectId,
    };

    const first = await resolveCmsMembership(database, identity, bootstrap);
    const second = await resolveCmsMembership(database, identity, bootstrap);

    expect(first).toMatchObject({
      id: expect.any(String),
      tenantId,
      objectId: adminObjectId,
      role: "admin",
      active: true,
    });
    expect(second.id).toBe(first.id);
    await expect(database.select().from(cmsMemberships)).resolves.toHaveLength(
      1,
    );
  });

  it("nao autoriza por email quando o oid nao possui membership", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    await resolveCmsMembership(
      database,
      {
        tenantId,
        objectId: adminObjectId,
        displayName: "Admin NITE",
        email: "admin@unijorge.com",
      },
      {
        tenantId,
        adminObjectId,
      },
    );

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000002",
          displayName: "Pessoa não autorizada",
          email: "admin@unijorge.com",
        },
        {
          tenantId,
          adminObjectId,
        },
      ),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
  });

  it.each(["admin", "publisher"] as const)(
    "sincroniza claims da propria membership %s uma unica vez",
    async (role) => {
      const database = drizzle(client, { schema: cmsSchema });
      const [membership] = await database
        .insert(cmsMemberships)
        .values({
          tenantId,
          objectId:
            role === "admin"
              ? "20000000-0000-4000-8000-000000000003"
              : "20000000-0000-4000-8000-000000000004",
          displayName: "Nome anterior",
          email: "anterior@unijorge.com",
          role,
        })
        .returning();
      const identity = {
        tenantId: membership.tenantId,
        objectId: membership.objectId,
        displayName: "Nome verificado no Entra",
        email: "atual@unijorge.com",
      };
      const bootstrap = {
        tenantId,
        adminObjectId,
      };

      const synchronized = await resolveCmsMembership(
        database,
        identity,
        bootstrap,
      );
      const repeated = await resolveCmsMembership(
        database,
        identity,
        bootstrap,
      );

      expect(synchronized).toMatchObject({
        id: membership.id,
        displayName: "Nome verificado no Entra",
        email: "atual@unijorge.com",
        role,
      });
      expect(repeated).toMatchObject(synchronized);
      await expect(database.select().from(auditEvents)).resolves.toMatchObject([
        {
          actorMembershipId: membership.id,
          action: "membership.profile.updated",
          aggregateType: "membership",
          aggregateId: membership.id,
          metadata: {
            tenantId,
            objectId: membership.objectId,
            changedFields: ["displayName", "email"],
          },
        },
      ]);
    },
  );

  it("nao sincroniza claims de uma membership inativa", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [membership] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: "20000000-0000-4000-8000-000000000005",
        displayName: "Nome preservado",
        email: "preservado@unijorge.com",
        role: "publisher",
        active: false,
      })
      .returning();
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: adminObjectId,
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();
    await database.insert(cmsMembershipInvitations).values({
      tenantId,
      email: "nao-salvar@unijorge.com",
      role: "publisher",
      expiresAt: new Date(Date.now() + 60_000),
      invitedByMembershipId: admin.id,
    });

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId: membership.tenantId,
          objectId: membership.objectId,
          displayName: "Nome que não deve ser salvo",
          email: "nao-salvar@unijorge.com",
        },
        {
          tenantId,
          adminObjectId,
        },
      ),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
    await expect(
      database
        .select()
        .from(cmsMemberships)
        .where(eq(cmsMemberships.id, membership.id)),
    ).resolves.toMatchObject([
      {
        id: membership.id,
        displayName: "Nome preservado",
        email: "preservado@unijorge.com",
        active: false,
      },
    ]);
    await expect(database.select().from(auditEvents)).resolves.toEqual([]);
    await expect(
      database.select().from(cmsMembershipInvitations),
    ).resolves.toMatchObject([{ status: "pending" }]);
  });

  it("aceita convite uma vez e usa tid + oid nos logins seguintes", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: adminObjectId,
        displayName: "Admin NITE",
        email: "admin@unijorge.com",
        role: "admin",
      })
      .returning();
    const [invitation] = await database
      .insert(cmsMembershipInvitations)
      .values({
        tenantId,
        email: "convidada@unijorge.com",
        role: "publisher",
        expiresAt: new Date(Date.now() + 60_000),
        invitedByMembershipId: admin.id,
      })
      .returning();
    const identity = {
      tenantId,
      objectId: "20000000-0000-4000-8000-000000000006",
      displayName: "Pessoa Convidada",
      email: "Convidada@UniJorge.com",
    };

    await expect(
      resolveCmsMembership(database, identity, { tenantId, adminObjectId }),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
    const accepted = await resolveCmsMembership(
      database,
      identity,
      { tenantId, adminObjectId },
      { invitationId: invitation.id },
    );
    const repeated = await resolveCmsMembership(
      database,
      { ...identity, email: "novo.email@unijorge.com" },
      { tenantId, adminObjectId },
    );

    expect(repeated.id).toBe(accepted.id);
    await expect(
      database.select().from(cmsMembershipInvitations),
    ).resolves.toMatchObject([
      {
        id: invitation.id,
        status: "accepted",
        acceptedMembershipId: accepted.id,
        acceptedAt: expect.any(Date),
      },
    ]);
    await expect(database.select().from(auditEvents)).resolves.toMatchObject([
      { action: "membership.created" },
      { action: "membership.invitation.accepted" },
      { action: "membership.profile.updated" },
    ]);
  });

  it("recusa convite expirado sem criar membership ou auditoria", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: adminObjectId,
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();
    const [invitation] = await database
      .insert(cmsMembershipInvitations)
      .values({
        tenantId,
        email: "expirada@unijorge.com",
        role: "publisher",
        expiresAt: new Date(Date.now() - 1),
        invitedByMembershipId: admin.id,
        createdAt: new Date(Date.now() - 60_000),
      })
      .returning();

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000007",
          displayName: "Convite Expirado",
          email: "expirada@unijorge.com",
        },
        { tenantId, adminObjectId },
        { invitationId: invitation.id },
      ),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
    await expect(database.select().from(cmsMemberships)).resolves.toHaveLength(
      1,
    );
    await expect(database.select().from(auditEvents)).resolves.toEqual([]);
  });

  it("preserva o nível administrativo definido no convite", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: adminObjectId,
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();
    const [invitation] = await database
      .insert(cmsMembershipInvitations)
      .values({
        tenantId,
        email: "nova.admin@unijorge.com",
        role: "admin",
        expiresAt: new Date(Date.now() + 60_000),
        invitedByMembershipId: admin.id,
      })
      .returning();

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000008",
          displayName: "Nova Administração",
          email: "nova.admin@unijorge.com",
        },
        { tenantId, adminObjectId },
        { invitationId: invitation.id },
      ),
    ).resolves.toMatchObject({ role: "admin", active: true });
  });

  it("não aceita convite revogado", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: adminObjectId,
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();
    const [invitation] = await database
      .insert(cmsMembershipInvitations)
      .values({
        tenantId,
        email: "revogada@unijorge.com",
        role: "publisher",
        status: "revoked",
        expiresAt: new Date(Date.now() + 60_000),
        invitedByMembershipId: admin.id,
        revokedAt: new Date(),
      })
      .returning();

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000009",
          displayName: "Convite Revogado",
          email: "revogada@unijorge.com",
        },
        { tenantId, adminObjectId },
        { invitationId: invitation.id },
      ),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
    await expect(database.select().from(cmsMemberships)).resolves.toHaveLength(
      1,
    );
  });

  it("reverte aceite, membership e auditoria quando a auditoria falha", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: adminObjectId,
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();
    const [invitation] = await database
      .insert(cmsMembershipInvitations)
      .values({
        tenantId,
        email: "rollback@unijorge.com",
        role: "publisher",
        expiresAt: new Date(Date.now() + 60_000),
        invitedByMembershipId: admin.id,
      })
      .returning();
    await client.exec(`
      create function reject_invitation_audit() returns trigger as $$
      begin
        if new.action = 'membership.invitation.accepted' then
          raise exception 'falha de auditoria simulada';
        end if;
        return new;
      end;
      $$ language plpgsql;
      create trigger reject_invitation_audit_trigger
      before insert on audit_events
      for each row execute function reject_invitation_audit();
    `);

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000010",
          displayName: "Rollback",
          email: "rollback@unijorge.com",
        },
        { tenantId, adminObjectId },
        { invitationId: invitation.id },
      ),
    ).rejects.toThrow();
    await expect(database.select().from(cmsMemberships)).resolves.toHaveLength(
      1,
    );
    await expect(
      database.select().from(cmsMembershipInvitations),
    ).resolves.toMatchObject([
      { status: "pending", acceptedMembershipId: null, acceptedAt: null },
    ]);
    await expect(database.select().from(auditEvents)).resolves.toEqual([]);
  });

  it("recusa contexto de aceite inexistente, de outro tenant ou e-mail", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId,
        objectId: adminObjectId,
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();
    const [invitation] = await database
      .insert(cmsMembershipInvitations)
      .values({
        tenantId,
        email: "correta@unijorge.com",
        role: "publisher",
        expiresAt: new Date(Date.now() + 60_000),
        invitedByMembershipId: admin.id,
      })
      .returning();
    const bootstrap = { tenantId, adminObjectId };

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000011",
          displayName: "ID inexistente",
          email: invitation.email,
        },
        bootstrap,
        { invitationId: "30000000-0000-4000-8000-000000000011" },
      ),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId,
          objectId: "20000000-0000-4000-8000-000000000012",
          displayName: "E-mail diferente",
          email: "diferente@unijorge.com",
        },
        bootstrap,
        { invitationId: invitation.id },
      ),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);

    const otherTenantId = "10000000-0000-4000-8000-000000000002";
    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId: otherTenantId,
          objectId: "20000000-0000-4000-8000-000000000013",
          displayName: "Outro tenant",
          email: invitation.email,
        },
        {
          tenantId: otherTenantId,
          adminObjectId: "20000000-0000-4000-8000-000000000099",
        },
        { invitationId: invitation.id },
      ),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);

    await expect(database.select().from(cmsMemberships)).resolves.toHaveLength(
      1,
    );
    await expect(
      database.select().from(cmsMembershipInvitations),
    ).resolves.toMatchObject([{ id: invitation.id, status: "pending" }]);
  });
});
