import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import * as editorial from "@nite/editorial";
import { auditEvents, cmsMemberships } from "@nite/cms-db";
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

  it("permite que admin crie publisher por tid + oid e impede publisher de administrar", async () => {
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

    await Reflect.apply(command("createCmsMembership"), undefined, [
      database,
      {
        actor: admin,
        identity: {
          tenantId: "tenant-nite",
          objectId: "novo-oid",
          displayName: "Nova Publisher",
          email: "nova@nite.test",
        },
        role: "publisher",
      },
    ]);

    await expect(
      database
        .select({ role: cmsMemberships.role, active: cmsMemberships.active })
        .from(cmsMemberships)
        .where(
          and(
            eq(cmsMemberships.tenantId, "tenant-nite"),
            eq(cmsMemberships.objectId, "novo-oid"),
          ),
        ),
    ).resolves.toEqual([{ role: "publisher", active: true }]);
    await expect(
      Reflect.apply(command("createCmsMembership"), undefined, [
        database,
        {
          actor: publisher,
          identity: {
            tenantId: "tenant-nite",
            objectId: "bloqueado-oid",
            displayName: "Pessoa Bloqueada",
          },
          role: "publisher",
        },
      ]),
    ).rejects.toThrow();
    await expect(database.select().from(auditEvents)).resolves.toMatchObject([
      {
        actorMembershipId: admin.id,
        action: "membership.created",
        aggregateType: "membership",
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
      Reflect.apply(command("createCmsMembership"), undefined, [
        database,
        {
          actor: admin,
          identity: {
            tenantId: foreignMembership.tenantId,
            objectId: "novo-foreign-oid",
            displayName: "Novo Externo",
          },
          role: "publisher",
        },
      ]),
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
    await expect(
      database
        .select()
        .from(cmsMemberships)
        .where(
          and(
            eq(cmsMemberships.tenantId, "tenant-externo"),
            eq(cmsMemberships.objectId, "novo-foreign-oid"),
          ),
        ),
    ).resolves.toEqual([]);
    await expect(database.select().from(auditEvents)).resolves.toEqual([]);
  });

  it("confirma somente uma demissão concorrente e preserva admin ativo no tenant", async () => {
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

    const results = await Promise.allSettled([
      Reflect.apply(command("changeCmsMembershipRole"), undefined, [
        database,
        {
          actor: firstAdmin,
          tenantId: secondAdmin.tenantId,
          objectId: secondAdmin.objectId,
          role: "publisher",
        },
      ]),
      Reflect.apply(command("changeCmsMembershipRole"), undefined, [
        database,
        {
          actor: secondAdmin,
          tenantId: firstAdmin.tenantId,
          objectId: firstAdmin.objectId,
          role: "publisher",
        },
      ]),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
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
