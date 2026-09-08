import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import * as editorial from "@nite/editorial";
import { CmsAuthorizationError } from "@nite/editorial";
import {
  auditEvents,
  cmsMembershipInvitations,
  cmsMemberships,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);

type DomainCommand = (...arguments_: readonly unknown[]) => unknown;

function command(name: string): DomainCommand {
  const candidate: unknown = Reflect.get(editorial, name);
  expect(candidate, `export ${name}`).toBeTypeOf("function");
  if (typeof candidate !== "function") {
    throw new Error(`export ${name} ausente`);
  }
  return (...arguments_) => Reflect.apply(candidate, undefined, arguments_);
}

describe("administração de memberships", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("permite que admin convide publisher e impede publisher de administrar", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin, publisher] = await database
      .insert(cmsMemberships)
      .values([
        {
          tenantId: "tenant-nite",
          objectId: "admin-oid",
          displayName: "Admin NITE",
          role: "admin",
        },
        {
          tenantId: "tenant-nite",
          objectId: "publisher-oid",
          displayName: "Publisher NITE",
          role: "publisher",
        },
      ])
      .returning();

    await Reflect.apply(command("createCmsMembershipInvitation"), undefined, [
      database,
      {
        actor: admin,
        email: "nova@unijorge.com",
        role: "publisher",
      },
    ]);

    await expect(
      database.select().from(cmsMembershipInvitations),
    ).resolves.toMatchObject([
      { email: "nova@unijorge.com", role: "publisher", status: "pending" },
    ]);
    await expect(
      Reflect.apply(command("createCmsMembershipInvitation"), undefined, [
        database,
        {
          actor: publisher,
          email: "bloqueada@unijorge.com",
          role: "publisher",
        },
      ]),
    ).rejects.toThrow();
    await expect(database.select().from(auditEvents)).resolves.toMatchObject([
      {
        actorMembershipId: admin.id,
        action: "membership.invitation.created",
        aggregateType: "membership_invitation",
      },
    ]);
  });

  it("admin atualiza papel e perfil Entra do membership identificado por tid + oid", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin, target] = await database
      .insert(cmsMemberships)
      .values([
        {
          tenantId: "tenant-nite",
          objectId: "admin-oid",
          displayName: "Admin NITE",
          role: "admin",
        },
        {
          tenantId: "tenant-nite",
          objectId: "target-oid",
          displayName: "Perfil Antigo",
          email: "antigo@nite.test",
          role: "publisher",
        },
      ])
      .returning();

    await Reflect.apply(command("changeCmsMembershipRole"), undefined, [
      database,
      {
        actor: admin,
        tenantId: target.tenantId,
        objectId: target.objectId,
        role: "admin",
      },
    ]);
    await Reflect.apply(command("updateCmsMembershipProfile"), undefined, [
      database,
      {
        actor: admin,
        identity: {
          tenantId: target.tenantId,
          objectId: target.objectId,
          displayName: "Perfil Entra Atualizado",
          email: "atualizado@nite.test",
        },
      },
    ]);

    await expect(
      database
        .select({
          role: cmsMemberships.role,
          displayName: cmsMemberships.displayName,
          email: cmsMemberships.email,
        })
        .from(cmsMemberships)
        .where(eq(cmsMemberships.id, target.id)),
    ).resolves.toEqual([
      {
        role: "admin",
        displayName: "Perfil Entra Atualizado",
        email: "atualizado@nite.test",
      },
    ]);
    await expect(database.select().from(auditEvents)).resolves.toMatchObject([
      { action: "membership.role.changed" },
      { action: "membership.profile.updated" },
    ]);
  });

  it("impede auto-bloqueio e a remoção do último admin ativo", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "admin-oid",
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();

    await expect(
      Reflect.apply(command("setCmsMembershipActive"), undefined, [
        database,
        {
          actor: admin,
          tenantId: admin.tenantId,
          objectId: admin.objectId,
          active: false,
        },
      ]),
    ).rejects.toThrow();
    await expect(
      Reflect.apply(command("changeCmsMembershipRole"), undefined, [
        database,
        {
          actor: admin,
          tenantId: admin.tenantId,
          objectId: admin.objectId,
          role: "publisher",
        },
      ]),
    ).rejects.toThrow();
    await expect(
      database
        .select({ role: cmsMemberships.role, active: cmsMemberships.active })
        .from(cmsMemberships)
        .where(eq(cmsMemberships.id, admin.id)),
    ).resolves.toEqual([{ role: "admin", active: true }]);
  });

  it("impede que admin alcance memberships de outro tenant", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin, foreignMembership] = await database
      .insert(cmsMemberships)
      .values([
        {
          tenantId: "tenant-nite",
          objectId: "admin-oid",
          displayName: "Admin NITE",
          role: "admin",
        },
        {
          tenantId: "tenant-externo",
          objectId: "foreign-oid",
          displayName: "Admin Externo",
          role: "admin",
        },
      ])
      .returning();

    const results = await Promise.allSettled([
      Reflect.apply(command("changeCmsMembershipRole"), undefined, [
        database,
        {
          actor: admin,
          tenantId: foreignMembership.tenantId,
          objectId: foreignMembership.objectId,
          role: "publisher",
        },
      ]),
      Reflect.apply(command("setCmsMembershipActive"), undefined, [
        database,
        {
          actor: admin,
          tenantId: foreignMembership.tenantId,
          objectId: foreignMembership.objectId,
          active: false,
        },
      ]),
      Reflect.apply(command("updateCmsMembershipProfile"), undefined, [
        database,
        {
          actor: admin,
          identity: {
            tenantId: foreignMembership.tenantId,
            objectId: foreignMembership.objectId,
            displayName: "Perfil Externo Alterado",
          },
        },
      ]),
    ]);

    expect(results.map(({ status }) => status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
    ]);
    await expect(
      database
        .select({
          role: cmsMemberships.role,
          active: cmsMemberships.active,
          displayName: cmsMemberships.displayName,
        })
        .from(cmsMemberships)
        .where(eq(cmsMemberships.id, foreignMembership.id)),
    ).resolves.toEqual([
      { role: "admin", active: true, displayName: "Admin Externo" },
    ]);
    await expect(database.select().from(auditEvents)).resolves.toEqual([]);
  });

  it("rejeita referência cross-tenant antes de distinguir alvo inexistente", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "admin-oid",
        displayName: "Admin NITE",
        role: "admin",
      })
      .returning();

    await expect(
      Reflect.apply(command("changeCmsMembershipRole"), undefined, [
        database,
        {
          actor: admin,
          tenantId: "tenant-externo",
          objectId: "oid-inexistente",
          role: "publisher",
        },
      ]),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
  });

  it("serializa duas transações independentes antes da demissão de admins", async () => {
    type Transaction = { id: number };
    type TenantMutationAdapter = {
      transaction<T>(
        operation: (transaction: Transaction) => Promise<T>,
      ): Promise<T>;
      withTenantLock<T>(
        transaction: Transaction,
        tenantId: string,
        operation: () => Promise<T>,
      ): Promise<T>;
    };

    const waitingByTenant = new Map<string, Promise<void>>();
    let nextTransactionId = 0;
    let activeMutationCount = 0;
    let maxActiveMutationCount = 0;
    let activeAdmins = 2;
    const adapter: TenantMutationAdapter = {
      async transaction(operation) {
        return operation({ id: ++nextTransactionId });
      },
      async withTenantLock(_transaction, tenantId, operation) {
        const previous = waitingByTenant.get(tenantId) ?? Promise.resolve();
        let release: (() => void) | undefined;
        const current = new Promise<void>((resolve) => {
          release = resolve;
        });
        waitingByTenant.set(
          tenantId,
          previous.then(() => current),
        );
        await previous;
        try {
          return await operation();
        } finally {
          release?.();
        }
      },
    };
    const demote = async (transaction: Transaction) => {
      expect(transaction.id).toBeGreaterThan(0);
      activeMutationCount += 1;
      maxActiveMutationCount = Math.max(
        maxActiveMutationCount,
        activeMutationCount,
      );
      try {
        if (activeAdmins <= 1) {
          throw new Error("último admin ativo");
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
        activeAdmins -= 1;
      } finally {
        activeMutationCount -= 1;
      }
    };

    const results = await Promise.allSettled([
      Reflect.apply(command("executeTenantScopedMutation"), undefined, [
        adapter,
        "tenant-nite",
        demote,
      ]),
      Reflect.apply(command("executeTenantScopedMutation"), undefined, [
        adapter,
        "tenant-nite",
        demote,
      ]),
    ]);

    expect(nextTransactionId).toBe(2);
    expect(maxActiveMutationCount).toBe(1);
    expect(activeAdmins).toBe(1);
    expect(results.map(({ status }) => status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
  });

  it("rejeita nova mutação de actor que já foi demitido no PGlite", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [firstAdmin, secondAdmin] = await database
      .insert(cmsMemberships)
      .values([
        {
          tenantId: "tenant-nite",
          objectId: "admin-um-oid",
          displayName: "Admin Um",
          role: "admin",
        },
        {
          tenantId: "tenant-nite",
          objectId: "admin-dois-oid",
          displayName: "Admin Dois",
          role: "admin",
        },
      ])
      .returning();

    await Reflect.apply(command("changeCmsMembershipRole"), undefined, [
      database,
      {
        actor: firstAdmin,
        tenantId: secondAdmin.tenantId,
        objectId: secondAdmin.objectId,
        role: "publisher",
      },
    ]);

    await expect(
      Reflect.apply(command("changeCmsMembershipRole"), undefined, [
        database,
        {
          actor: secondAdmin,
          tenantId: firstAdmin.tenantId,
          objectId: firstAdmin.objectId,
          role: "publisher",
        },
      ]),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
    await expect(
      database
        .select({ id: cmsMemberships.id })
        .from(cmsMemberships)
        .where(
          and(
            eq(cmsMemberships.tenantId, "tenant-nite"),
            eq(cmsMemberships.role, "admin"),
            eq(cmsMemberships.active, true),
          ),
        ),
    ).resolves.toHaveLength(1);
    await expect(database.select().from(auditEvents)).resolves.toMatchObject([
      { action: "membership.role.changed" },
    ]);
  });
});
