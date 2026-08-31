import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import { CmsAuthorizationError, resolveCmsMembership } from "@nite/editorial";
import { auditEvents, cmsMemberships } from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);

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
      tenantId: "tenant-nite",
      objectId: "entra-object-admin",
      displayName: "Admin NITE",
      email: "admin@nite.test",
    };
    const bootstrap = {
      tenantId: "tenant-nite",
      adminObjectId: "entra-object-admin",
    };

    const first = await resolveCmsMembership(database, identity, bootstrap);
    const second = await resolveCmsMembership(database, identity, bootstrap);

    expect(first).toMatchObject({
      id: expect.any(String),
      tenantId: "tenant-nite",
      objectId: "entra-object-admin",
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
        tenantId: "tenant-nite",
        objectId: "entra-object-admin",
        displayName: "Admin NITE",
        email: "admin@nite.test",
      },
      {
        tenantId: "tenant-nite",
        adminObjectId: "entra-object-admin",
      },
    );

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId: "tenant-nite",
          objectId: "outro-oid",
          displayName: "Pessoa não autorizada",
          email: "admin@nite.test",
        },
        {
          tenantId: "tenant-nite",
          adminObjectId: "entra-object-admin",
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
          tenantId: "tenant-nite",
          objectId: `${role}-oid`,
          displayName: "Nome anterior",
          email: "anterior@nite.test",
          role,
        })
        .returning();
      const identity = {
        tenantId: membership.tenantId,
        objectId: membership.objectId,
        displayName: "Nome verificado no Entra",
        email: "atual@nite.test",
      };
      const bootstrap = {
        tenantId: "tenant-nite",
        adminObjectId: "bootstrap-admin-oid",
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
        email: "atual@nite.test",
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
            tenantId: "tenant-nite",
            objectId: `${role}-oid`,
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
        tenantId: "tenant-nite",
        objectId: "inactive-oid",
        displayName: "Nome preservado",
        email: "preservado@nite.test",
        role: "publisher",
        active: false,
      })
      .returning();

    await expect(
      resolveCmsMembership(
        database,
        {
          tenantId: membership.tenantId,
          objectId: membership.objectId,
          displayName: "Nome que não deve ser salvo",
          email: "nao-salvar@nite.test",
        },
        {
          tenantId: "tenant-nite",
          adminObjectId: "bootstrap-admin-oid",
        },
      ),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
    await expect(database.select().from(cmsMemberships)).resolves.toMatchObject(
      [
        {
          id: membership.id,
          displayName: "Nome preservado",
          email: "preservado@nite.test",
          active: false,
        },
      ],
    );
    await expect(database.select().from(auditEvents)).resolves.toEqual([]);
  });
});
