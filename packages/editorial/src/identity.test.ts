import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import { CmsAuthorizationError, resolveCmsMembership } from "@nite/editorial";
import { cmsMemberships } from "@nite/cms-db";
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
});
