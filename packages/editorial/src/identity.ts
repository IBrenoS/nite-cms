import { and, eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import { z } from "zod";

import * as schema from "@nite/cms-db/schema";
import { cmsMemberships, type CmsMembership } from "@nite/cms-db";

const entraIdentitySchema = z.object({
  tenantId: z.string().min(1).max(64),
  objectId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(160),
  email: z.email().max(320).optional(),
});

const bootstrapAdminSchema = z.object({
  tenantId: z.string().min(1).max(64),
  adminObjectId: z.string().min(1).max(128),
});

export type EntraIdentity = z.infer<typeof entraIdentitySchema>;
export type BootstrapAdmin = z.infer<typeof bootstrapAdminSchema>;

export class CmsAuthorizationError extends Error {
  constructor() {
    super("Identidade sem acesso ao CMS.");
    this.name = "CmsAuthorizationError";
  }
}

export type CmsDatabase<TQueryResult extends PgQueryResultHKT> = PgDatabase<
  TQueryResult,
  typeof schema
>;

async function findMembership<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  identity: EntraIdentity,
) {
  const [membership] = await database
    .select()
    .from(cmsMemberships)
    .where(
      and(
        eq(cmsMemberships.tenantId, identity.tenantId),
        eq(cmsMemberships.objectId, identity.objectId),
      ),
    )
    .limit(1);

  return membership;
}

function assertActiveMembership(
  membership: CmsMembership | undefined,
): CmsMembership {
  if (!membership?.active) {
    throw new CmsAuthorizationError();
  }

  return membership;
}

export async function requireActiveCmsMembership<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  membershipId: string,
): Promise<CmsMembership> {
  const [membership] = await database
    .select()
    .from(cmsMemberships)
    .where(eq(cmsMemberships.id, membershipId))
    .limit(1);

  return assertActiveMembership(membership);
}

export async function resolveCmsMembership<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  rawIdentity: EntraIdentity,
  rawBootstrap: BootstrapAdmin,
): Promise<CmsMembership> {
  const identity = entraIdentitySchema.parse(rawIdentity);
  const bootstrap = bootstrapAdminSchema.parse(rawBootstrap);

  if (identity.tenantId !== bootstrap.tenantId) {
    throw new CmsAuthorizationError();
  }

  const existingMembership = await findMembership(database, identity);
  if (existingMembership) {
    return assertActiveMembership(existingMembership);
  }

  if (identity.objectId !== bootstrap.adminObjectId) {
    throw new CmsAuthorizationError();
  }

  await database
    .insert(cmsMemberships)
    .values({
      tenantId: identity.tenantId,
      objectId: identity.objectId,
      displayName: identity.displayName,
      email: identity.email,
      role: "admin",
    })
    .onConflictDoNothing({
      target: [cmsMemberships.tenantId, cmsMemberships.objectId],
    });

  return assertActiveMembership(await findMembership(database, identity));
}
