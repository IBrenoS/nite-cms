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

const cmsRoleSchema = z.enum(["admin", "publisher"]);
const membershipReferenceSchema = z.object({
  tenantId: z.string().min(1).max(64),
  objectId: z.string().min(1).max(128),
});

export type EntraIdentity = z.infer<typeof entraIdentitySchema>;
export type BootstrapAdmin = z.infer<typeof bootstrapAdminSchema>;

export class CmsAuthorizationError extends Error {
  constructor() {
    super("Identidade sem acesso ao CMS.");
    this.name = "CmsAuthorizationError";
  }
}

export class CmsMembershipManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CmsMembershipManagementError";
  }
}

export type CmsDatabase<TQueryResult extends PgQueryResultHKT> = PgDatabase<
  TQueryResult,
  typeof schema
>;

async function findMembership<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  identity: Pick<EntraIdentity, "tenantId" | "objectId">,
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

function assertAdminMembership(membership: CmsMembership) {
  if (membership.role !== "admin") {
    throw new CmsAuthorizationError();
  }
  return membership;
}

async function requireAdminMembership<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  membershipId: string,
) {
  return assertAdminMembership(
    await requireActiveCmsMembership(database, membershipId),
  );
}

async function requireTargetMembership<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  actor: CmsMembership,
  rawReference: z.infer<typeof membershipReferenceSchema>,
) {
  const reference = membershipReferenceSchema.parse(rawReference);
  const [target] = await database
    .select()
    .from(cmsMemberships)
    .where(
      and(
        eq(cmsMemberships.tenantId, reference.tenantId),
        eq(cmsMemberships.objectId, reference.objectId),
      ),
    )
    .limit(1)
    .for("update");
  if (!target) {
    throw new CmsMembershipManagementError("Membership não encontrado.");
  }
  if (target.tenantId !== actor.tenantId) {
    throw new CmsAuthorizationError();
  }
  return target;
}

async function assertAdminCanBeRemoved<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  actor: CmsMembership,
  target: CmsMembership,
) {
  if (target.id === actor.id) {
    throw new CmsMembershipManagementError(
      "Um admin não pode remover o próprio acesso administrativo.",
    );
  }
  if (target.role !== "admin" || !target.active) return;

  const activeAdmins = await database
    .select({ id: cmsMemberships.id })
    .from(cmsMemberships)
    .where(
      and(
        eq(cmsMemberships.tenantId, target.tenantId),
        eq(cmsMemberships.role, "admin"),
        eq(cmsMemberships.active, true),
      ),
    )
    .for("update");
  if (activeAdmins.length <= 1) {
    throw new CmsMembershipManagementError(
      "O último admin ativo não pode perder acesso administrativo.",
    );
  }
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

export async function createCmsMembership<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    identity: EntraIdentity;
    role: z.infer<typeof cmsRoleSchema>;
  },
) {
  const identity = entraIdentitySchema.parse(command.identity);
  const role = cmsRoleSchema.parse(command.role);

  return database.transaction(async (transaction) => {
    const actor = await requireAdminMembership(transaction, command.actor.id);
    if (identity.tenantId !== actor.tenantId) {
      throw new CmsAuthorizationError();
    }
    const [membership] = await transaction
      .insert(cmsMemberships)
      .values({ ...identity, role, active: true })
      .returning();
    await transaction.insert(schema.auditEvents).values({
      actorMembershipId: actor.id,
      action: "membership.created",
      aggregateType: "membership",
      aggregateId: membership.id,
      metadata: {
        tenantId: membership.tenantId,
        objectId: membership.objectId,
        role,
      },
    });
    return membership;
  });
}

export async function changeCmsMembershipRole<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    tenantId: string;
    objectId: string;
    role: z.infer<typeof cmsRoleSchema>;
  },
) {
  const reference = membershipReferenceSchema.parse(command);
  const role = cmsRoleSchema.parse(command.role);

  return database.transaction(async (transaction) => {
    const actor = await requireAdminMembership(transaction, command.actor.id);
    const target = await requireTargetMembership(transaction, actor, reference);
    if (target.role === role) return target;
    if (target.role === "admin" && role !== "admin") {
      await assertAdminCanBeRemoved(transaction, actor, target);
    }
    const [membership] = await transaction
      .update(cmsMemberships)
      .set({ role, updatedAt: new Date() })
      .where(eq(cmsMemberships.id, target.id))
      .returning();
    await transaction.insert(schema.auditEvents).values({
      actorMembershipId: actor.id,
      action: "membership.role.changed",
      aggregateType: "membership",
      aggregateId: target.id,
      metadata: { previousRole: target.role, role },
    });
    return membership;
  });
}

export async function setCmsMembershipActive<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    tenantId: string;
    objectId: string;
    active: boolean;
  },
) {
  const reference = membershipReferenceSchema.parse(command);
  const active = z.boolean().parse(command.active);

  return database.transaction(async (transaction) => {
    const actor = await requireAdminMembership(transaction, command.actor.id);
    const target = await requireTargetMembership(transaction, actor, reference);
    if (target.active === active) return target;
    if (!active && target.role === "admin") {
      await assertAdminCanBeRemoved(transaction, actor, target);
    }
    const [membership] = await transaction
      .update(cmsMemberships)
      .set({ active, updatedAt: new Date() })
      .where(eq(cmsMemberships.id, target.id))
      .returning();
    await transaction.insert(schema.auditEvents).values({
      actorMembershipId: actor.id,
      action: "membership.active.changed",
      aggregateType: "membership",
      aggregateId: target.id,
      metadata: { active },
    });
    return membership;
  });
}

export async function updateCmsMembershipProfile<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: { actor: CmsMembership; identity: EntraIdentity },
) {
  const identity = entraIdentitySchema.parse(command.identity);

  return database.transaction(async (transaction) => {
    const actor = await requireAdminMembership(transaction, command.actor.id);
    const target = await requireTargetMembership(transaction, actor, identity);
    const [membership] = await transaction
      .update(cmsMemberships)
      .set({
        displayName: identity.displayName,
        email: identity.email,
        updatedAt: new Date(),
      })
      .where(eq(cmsMemberships.id, target.id))
      .returning();
    await transaction.insert(schema.auditEvents).values({
      actorMembershipId: actor.id,
      action: "membership.profile.updated",
      aggregateType: "membership",
      aggregateId: target.id,
      metadata: { tenantId: target.tenantId, objectId: target.objectId },
    });
    return membership;
  });
}
