import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient } from "pg";
import { fileURLToPath } from "node:url";

import { changeCmsMembershipRole } from "@nite/editorial";
import { auditEvents, cmsMemberships } from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);
const testDatabaseUrl = process.env.CMS_TEST_DATABASE_URL;
const postgresIt = testDatabaseUrl ? it : it.skip;

describe("administração de memberships com PostgreSQL", () => {
  let firstPool: Pool | undefined;
  let secondPool: Pool | undefined;
  let lockPool: Pool | undefined;
  let lockClient: PoolClient | undefined;

  beforeEach(async () => {
    if (!testDatabaseUrl) return;

    firstPool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    secondPool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    lockPool = new Pool({ connectionString: testDatabaseUrl, max: 1 });

    await firstPool.query(
      "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
    );
    await firstPool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    await migrate(drizzle(firstPool), { migrationsFolder });
  });

  afterEach(async () => {
    try {
      await lockClient?.query("ROLLBACK");
    } finally {
      lockClient?.release();
      await Promise.all([firstPool?.end(), secondPool?.end(), lockPool?.end()]);
      firstPool = undefined;
      secondPool = undefined;
      lockPool = undefined;
      lockClient = undefined;
    }
  });

  postgresIt(
    "serializa duas demissões incompatíveis em sessões PostgreSQL independentes",
    async () => {
      const firstDatabase = drizzle(firstPool!, { schema: cmsSchema });
      const secondDatabase = drizzle(secondPool!, { schema: cmsSchema });
      const [firstAdmin, secondAdmin] = await firstDatabase
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

      lockClient = await lockPool!.connect();
      await lockClient.query("BEGIN");
      await lockClient.query(
        "SELECT id FROM cms_memberships WHERE tenant_id = $1 ORDER BY id FOR UPDATE",
        ["tenant-nite"],
      );

      const firstDemotion = changeCmsMembershipRole(firstDatabase, {
        actor: firstAdmin,
        tenantId: secondAdmin.tenantId,
        objectId: secondAdmin.objectId,
        role: "publisher",
      });
      const secondDemotion = changeCmsMembershipRole(secondDatabase, {
        actor: secondAdmin,
        tenantId: firstAdmin.tenantId,
        objectId: firstAdmin.objectId,
        role: "publisher",
      });

      await expect(
        Promise.race([
          Promise.allSettled([firstDemotion, secondDemotion]).then(
            () => "settled",
          ),
          new Promise((resolve) => setTimeout(resolve, 100, "waiting")),
        ]),
      ).resolves.toBe("waiting");

      await lockClient.query("COMMIT");
      lockClient.release();
      lockClient = undefined;

      const results = await Promise.allSettled([firstDemotion, secondDemotion]);
      expect(results.map(({ status }) => status)).toContain("fulfilled");
      expect(results.map(({ status }) => status)).toContain("rejected");
      await expect(
        firstDatabase
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
      await expect(
        firstDatabase.select().from(auditEvents),
      ).resolves.toMatchObject([{ action: "membership.role.changed" }]);
    },
  );
});
