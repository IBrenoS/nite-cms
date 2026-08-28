import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient } from "pg";
import { fileURLToPath } from "node:url";

import { changeCmsMembershipRole } from "@nite/editorial";
import { auditEvents, cmsMemberships } from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

import { resolvePostgresTestDatabaseUrl } from "./postgres-test-database";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);
const testDatabaseUrl = resolvePostgresTestDatabaseUrl({
  databaseUrl: process.env.CMS_TEST_DATABASE_URL,
  allowDatabaseReset: process.env.CMS_TEST_ALLOW_DATABASE_RESET,
});
const postgresIt = testDatabaseUrl ? it : it.skip;

const firstApplicationName = "nite-cms-membership-first-demotion";
const secondApplicationName = "nite-cms-membership-second-demotion";
const lockApplicationName = "nite-cms-membership-lock-holder";

interface SessionLockState {
  applicationName: string;
  ungrantedLockCount: number;
  waitEventType: string | null;
}

async function waitForBlockedSessions(
  observer: PoolClient,
  applicationNames: readonly string[],
  timeoutMilliseconds = 5_000,
) {
  const deadline = Date.now() + timeoutMilliseconds;
  let latestStates: SessionLockState[] = [];

  while (Date.now() < deadline) {
    const result = await observer.query<SessionLockState>(
      `SELECT
        activity.application_name AS "applicationName",
        activity.wait_event_type AS "waitEventType",
        COUNT(*) FILTER (WHERE locks.granted = false)::int AS "ungrantedLockCount"
      FROM pg_stat_activity AS activity
      LEFT JOIN pg_locks AS locks ON locks.pid = activity.pid
      WHERE activity.datname = current_database()
        AND activity.application_name = ANY($1::text[])
      GROUP BY activity.application_name, activity.wait_event_type`,
      [applicationNames],
    );
    latestStates = result.rows;

    const stateByApplication = new Map(
      latestStates.map((state) => [state.applicationName, state]),
    );
    if (
      applicationNames.every((applicationName) => {
        const state = stateByApplication.get(applicationName);
        return state?.waitEventType === "Lock" && state.ungrantedLockCount > 0;
      })
    ) {
      return stateByApplication;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(
    `Sessões não alcançaram locks pendentes antes do deadline: ${JSON.stringify(latestStates)}`,
  );
}

describe("administração de memberships com PostgreSQL", () => {
  let firstPool: Pool | undefined;
  let secondPool: Pool | undefined;
  let lockPool: Pool | undefined;
  let lockClient: PoolClient | undefined;

  beforeEach(async () => {
    if (!testDatabaseUrl) return;

    firstPool = new Pool({
      connectionString: testDatabaseUrl,
      application_name: firstApplicationName,
      max: 1,
    });
    secondPool = new Pool({
      connectionString: testDatabaseUrl,
      application_name: secondApplicationName,
      max: 1,
    });
    lockPool = new Pool({
      connectionString: testDatabaseUrl,
      application_name: lockApplicationName,
      max: 1,
    });

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
      await Promise.all([
        firstPool!.query("SELECT 1"),
        secondPool!.query("SELECT 1"),
      ]);
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
      const demotionResults = Promise.allSettled([
        firstDemotion,
        secondDemotion,
      ]);

      const blockedSessions = await waitForBlockedSessions(lockClient, [
        firstApplicationName,
        secondApplicationName,
      ]);
      expect(blockedSessions.get(firstApplicationName)).toMatchObject({
        waitEventType: "Lock",
      });
      expect(
        blockedSessions.get(firstApplicationName)?.ungrantedLockCount,
      ).toBeGreaterThan(0);
      expect(blockedSessions.get(secondApplicationName)).toMatchObject({
        waitEventType: "Lock",
      });
      expect(
        blockedSessions.get(secondApplicationName)?.ungrantedLockCount,
      ).toBeGreaterThan(0);

      await lockClient.query("COMMIT");
      lockClient.release();
      lockClient = undefined;

      const results = await demotionResults;
      expect(results.map(({ status }) => status)).toContain("fulfilled");
      expect(results.map(({ status }) => status)).toContain("rejected");
      const successfulActor =
        results[0].status === "fulfilled" ? firstAdmin : secondAdmin;
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
        firstDatabase
          .select({
            action: auditEvents.action,
            actorMembershipId: auditEvents.actorMembershipId,
          })
          .from(auditEvents),
      ).resolves.toEqual([
        {
          action: "membership.role.changed",
          actorMembershipId: successfulActor.id,
        },
      ]);
    },
    10_000,
  );
});
