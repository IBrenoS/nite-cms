import { and, eq, ne, sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import { z } from "zod";

import * as schema from "@nite/cms-db/schema";
import {
  cmsMembershipInvitations,
  cmsMemberships,
  type CmsMembership,
} from "@nite/cms-db";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const institutionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(320))
  .refine(
    (email) =>
      email.endsWith("@unijorge.com") || email.endsWith("@unijorge.com.br"),
    {
      message: "Use um e-mail institucional @unijorge.com ou @unijorge.com.br.",
    },
  );

const entraIdentitySchema = z.object({
  tenantId: z.string().min(1).max(64),
  objectId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(160),
  email: z.email().max(320).optional(),
});
const entraLoginIdentitySchema = entraIdentitySchema.extend({
  tenantId: z.uuid(),
  objectId: z.uuid(),
});

const bootstrapAdminSchema = z.object({
  tenantId: z.uuid(),
  adminObjectId: z.uuid(),
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

export class CmsMembershipInvitationError extends Error {
  constructor(
    public readonly code:
      | "duplicate"
      | "expired"
      | "invalid_state"
      | "member_exists"
      | "no_change"
      | "not_found",
  ) {
    super(`Convite de acesso inválido: ${code}.`);
    this.name = "CmsMembershipInvitationError";
  }
}

export function normalizeCmsInvitationEmail(email: string): string {
  return institutionalEmailSchema.parse(email);
}

export type CmsDatabase<TQueryResult extends PgQueryResultHKT> = PgDatabase<
  TQueryResult,
  typeof schema
>;

export interface TenantMutationAdapter<TTransaction> {
  transaction<T>(
    operation: (transaction: TTransaction) => Promise<T>,
  ): Promise<T>;
  withTenantLock<T>(
    transaction: TTransaction,
    tenantId: string,
    operation: () => Promise<T>,
  ): Promise<T>;
}

export function executeTenantScopedMutation<TTransaction, T>(
  adapter: TenantMutationAdapter<TTransaction>,
  tenantId: string,
  operation: (transaction: TTransaction) => Promise<T>,
) {
  return adapter.transaction((transaction) =>
    adapter.withTenantLock(transaction, tenantId, () => operation(transaction)),
  );
}

function createDatabaseTenantMutationAdapter<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
): TenantMutationAdapter<CmsDatabase<TQueryResult>> {
  return {
    transaction: (operation) => database.transaction(operation),
    async withTenantLock(transaction, tenantId, operation) {
      await transaction
        .select({ id: cmsMemberships.id })
        .from(cmsMemberships)
        .where(eq(cmsMemberships.tenantId, tenantId))
        .orderBy(cmsMemberships.id)
        .for("update");
      return operation();
    },
  };
}

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

function getChangedProfileFields(
  membership: CmsMembership,
  identity: EntraIdentity,
) {
  const changedFields: Array<"displayName" | "email"> = [];
  if (membership.displayName !== identity.displayName) {
    changedFields.push("displayName");
  }
  if (membership.email !== (identity.email ?? null)) {
    changedFields.push("email");
  }
  return changedFields;
}

function assertAdminMembership(membership: CmsMembership) {
  if (membership.role !== "admin") {
    throw new CmsAuthorizationError();
  }
  return membership;
}

function assertTenantReference(actorTenantId: string, targetTenantId: string) {
  if (actorTenantId !== targetTenantId) {
    throw new CmsAuthorizationError();
  }
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
  const identity = entraLoginIdentitySchema.parse(rawIdentity);
  const bootstrap = bootstrapAdminSchema.parse(rawBootstrap);

  if (identity.tenantId !== bootstrap.tenantId) {
    throw new CmsAuthorizationError();
  }

  return executeTenantScopedMutation(
    createDatabaseTenantMutationAdapter(database),
    identity.tenantId,
    async (transaction) => {
      const [existingMembership] = await transaction
        .select()
        .from(cmsMemberships)
        .where(
          and(
            eq(cmsMemberships.tenantId, identity.tenantId),
            eq(cmsMemberships.objectId, identity.objectId),
          ),
        )
        .limit(1)
        .for("update");
      if (existingMembership) {
        const activeMembership = assertActiveMembership(existingMembership);
        const changedFields = getChangedProfileFields(
          activeMembership,
          identity,
        );
        if (changedFields.length === 0) return activeMembership;

        const [updatedMembership] = await transaction
          .update(cmsMemberships)
          .set({
            displayName: identity.displayName,
            email: identity.email ?? null,
            updatedAt: new Date(),
          })
          .where(eq(cmsMemberships.id, activeMembership.id))
          .returning();
        await transaction.insert(schema.auditEvents).values({
          actorMembershipId: activeMembership.id,
          action: "membership.profile.updated",
          aggregateType: "membership",
          aggregateId: activeMembership.id,
          metadata: {
            tenantId: activeMembership.tenantId,
            objectId: activeMembership.objectId,
            changedFields,
          },
        });
        return updatedMembership;
      }

      if (identity.objectId === bootstrap.adminObjectId) {
        await transaction
          .insert(cmsMemberships)
          .values({
            tenantId: identity.tenantId,
            objectId: identity.objectId,
            displayName: identity.displayName,
            email: identity.email ?? null,
            role: "admin",
          })
          .onConflictDoNothing({
            target: [cmsMemberships.tenantId, cmsMemberships.objectId],
          });

        return assertActiveMembership(
          await findMembership(transaction, identity),
        );
      }

      if (!identity.email) throw new CmsAuthorizationError();
      const normalizedEmail = institutionalEmailSchema.safeParse(
        identity.email,
      );
      if (!normalizedEmail.success) throw new CmsAuthorizationError();
      const email = normalizedEmail.data;
      const [membershipWithEmail] = await transaction
        .select({ id: cmsMemberships.id })
        .from(cmsMemberships)
        .where(
          and(
            eq(cmsMemberships.tenantId, identity.tenantId),
            sql`lower(${cmsMemberships.email}) = ${email}`,
          ),
        )
        .limit(1)
        .for("update");
      if (membershipWithEmail) throw new CmsAuthorizationError();

      const now = new Date();
      const [invitation] = await transaction
        .select()
        .from(cmsMembershipInvitations)
        .where(
          and(
            eq(cmsMembershipInvitations.tenantId, identity.tenantId),
            eq(cmsMembershipInvitations.email, email),
            eq(cmsMembershipInvitations.status, "pending"),
          ),
        )
        .limit(1)
        .for("update");
      if (!invitation || invitation.expiresAt <= now) {
        throw new CmsAuthorizationError();
      }

      const [membership] = await transaction
        .insert(cmsMemberships)
        .values({
          tenantId: identity.tenantId,
          objectId: identity.objectId,
          displayName: identity.displayName,
          email,
          role: invitation.role,
          active: true,
        })
        .returning();
      const [acceptedInvitation] = await transaction
        .update(cmsMembershipInvitations)
        .set({
          status: "accepted",
          acceptedMembershipId: membership.id,
          acceptedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(cmsMembershipInvitations.id, invitation.id),
            eq(cmsMembershipInvitations.status, "pending"),
          ),
        )
        .returning({ id: cmsMembershipInvitations.id });
      if (!acceptedInvitation) throw new CmsAuthorizationError();
      await transaction.insert(schema.auditEvents).values([
        {
          actorMembershipId: membership.id,
          action: "membership.created",
          aggregateType: "membership",
          aggregateId: membership.id,
          metadata: { role: membership.role, invitationId: invitation.id },
        },
        {
          actorMembershipId: membership.id,
          action: "membership.invitation.accepted",
          aggregateType: "membership_invitation",
          aggregateId: invitation.id,
          metadata: { membershipId: membership.id, role: membership.role },
        },
      ]);
      return membership;
    },
  );
}

async function assertInvitationEmailAvailable<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  tenantId: string,
  email: string,
  excludingInvitationId?: string,
) {
  const [membership] = await database
    .select({ id: cmsMemberships.id })
    .from(cmsMemberships)
    .where(
      and(
        eq(cmsMemberships.tenantId, tenantId),
        sql`lower(${cmsMemberships.email}) = ${email}`,
      ),
    )
    .limit(1);
  if (membership) throw new CmsMembershipInvitationError("member_exists");

  const conditions = [
    eq(cmsMembershipInvitations.tenantId, tenantId),
    eq(cmsMembershipInvitations.email, email),
    eq(cmsMembershipInvitations.status, "pending"),
  ];
  if (excludingInvitationId) {
    conditions.push(ne(cmsMembershipInvitations.id, excludingInvitationId));
  }
  const [invitation] = await database
    .select({ id: cmsMembershipInvitations.id })
    .from(cmsMembershipInvitations)
    .where(and(...conditions))
    .limit(1);
  if (invitation) throw new CmsMembershipInvitationError("duplicate");
}

export async function createCmsMembershipInvitation<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    email: string;
    role: z.infer<typeof cmsRoleSchema>;
  },
) {
  const email = normalizeCmsInvitationEmail(command.email);
  const role = cmsRoleSchema.parse(command.role);
  return executeTenantScopedMutation(
    createDatabaseTenantMutationAdapter(database),
    command.actor.tenantId,
    async (transaction) => {
      const actor = await requireAdminMembership(transaction, command.actor.id);
      await assertInvitationEmailAvailable(transaction, actor.tenantId, email);
      const now = new Date();
      const [invitation] = await transaction
        .insert(cmsMembershipInvitations)
        .values({
          tenantId: actor.tenantId,
          email,
          role,
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
          invitedByMembershipId: actor.id,
        })
        .returning();
      await transaction.insert(schema.auditEvents).values({
        actorMembershipId: actor.id,
        action: "membership.invitation.created",
        aggregateType: "membership_invitation",
        aggregateId: invitation.id,
        metadata: { role, replacesInvitationId: null },
      });
      return invitation;
    },
  );
}

export async function replaceCmsMembershipInvitation<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    invitationId: string;
    email: string;
    role: z.infer<typeof cmsRoleSchema>;
  },
) {
  const invitationId = z.uuid().parse(command.invitationId);
  const email = normalizeCmsInvitationEmail(command.email);
  const role = cmsRoleSchema.parse(command.role);
  return executeTenantScopedMutation(
    createDatabaseTenantMutationAdapter(database),
    command.actor.tenantId,
    async (transaction) => {
      const actor = await requireAdminMembership(transaction, command.actor.id);
      const [original] = await transaction
        .select()
        .from(cmsMembershipInvitations)
        .where(eq(cmsMembershipInvitations.id, invitationId))
        .limit(1)
        .for("update");
      if (!original || original.tenantId !== actor.tenantId) {
        throw new CmsMembershipInvitationError("not_found");
      }
      if (original.status !== "pending") {
        throw new CmsMembershipInvitationError("invalid_state");
      }
      if (original.email === email && original.role === role) {
        throw new CmsMembershipInvitationError("no_change");
      }
      await assertInvitationEmailAvailable(
        transaction,
        actor.tenantId,
        email,
        original.id,
      );
      const now = new Date();
      await transaction
        .update(cmsMembershipInvitations)
        .set({ status: "revoked", revokedAt: now, updatedAt: now })
        .where(eq(cmsMembershipInvitations.id, original.id));
      const [replacement] = await transaction
        .insert(cmsMembershipInvitations)
        .values({
          tenantId: actor.tenantId,
          email,
          role,
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
          invitedByMembershipId: actor.id,
          replacesInvitationId: original.id,
        })
        .returning();
      await transaction.insert(schema.auditEvents).values([
        {
          actorMembershipId: actor.id,
          action: "membership.invitation.revoked",
          aggregateType: "membership_invitation",
          aggregateId: original.id,
          metadata: {
            reason: "replaced",
            replacementInvitationId: replacement.id,
          },
        },
        {
          actorMembershipId: actor.id,
          action: "membership.invitation.created",
          aggregateType: "membership_invitation",
          aggregateId: replacement.id,
          metadata: { role, replacesInvitationId: original.id },
        },
      ]);
      return replacement;
    },
  );
}

export async function revokeCmsMembershipInvitation<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: { actor: CmsMembership; invitationId: string },
) {
  const invitationId = z.uuid().parse(command.invitationId);
  return executeTenantScopedMutation(
    createDatabaseTenantMutationAdapter(database),
    command.actor.tenantId,
    async (transaction) => {
      const actor = await requireAdminMembership(transaction, command.actor.id);
      const [invitation] = await transaction
        .select()
        .from(cmsMembershipInvitations)
        .where(eq(cmsMembershipInvitations.id, invitationId))
        .limit(1)
        .for("update");
      if (!invitation || invitation.tenantId !== actor.tenantId) {
        throw new CmsMembershipInvitationError("not_found");
      }
      if (invitation.status !== "pending") {
        throw new CmsMembershipInvitationError("invalid_state");
      }
      const now = new Date();
      const [revoked] = await transaction
        .update(cmsMembershipInvitations)
        .set({ status: "revoked", revokedAt: now, updatedAt: now })
        .where(eq(cmsMembershipInvitations.id, invitation.id))
        .returning();
      await transaction.insert(schema.auditEvents).values({
        actorMembershipId: actor.id,
        action: "membership.invitation.revoked",
        aggregateType: "membership_invitation",
        aggregateId: invitation.id,
        metadata: { reason: "cancelled" },
      });
      return revoked;
    },
  );
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
  assertTenantReference(command.actor.tenantId, reference.tenantId);

  return executeTenantScopedMutation(
    createDatabaseTenantMutationAdapter(database),
    reference.tenantId,
    async (transaction) => {
      const actor = await requireAdminMembership(transaction, command.actor.id);
      assertTenantReference(actor.tenantId, reference.tenantId);
      const target = await requireTargetMembership(transaction, reference);
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
    },
  );
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
  assertTenantReference(command.actor.tenantId, reference.tenantId);

  return executeTenantScopedMutation(
    createDatabaseTenantMutationAdapter(database),
    reference.tenantId,
    async (transaction) => {
      const actor = await requireAdminMembership(transaction, command.actor.id);
      assertTenantReference(actor.tenantId, reference.tenantId);
      const target = await requireTargetMembership(transaction, reference);
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
    },
  );
}

export async function updateCmsMembershipProfile<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: { actor: CmsMembership; identity: EntraIdentity },
) {
  const identity = entraIdentitySchema.parse(command.identity);
  assertTenantReference(command.actor.tenantId, identity.tenantId);

  return executeTenantScopedMutation(
    createDatabaseTenantMutationAdapter(database),
    identity.tenantId,
    async (transaction) => {
      const actor = await requireAdminMembership(transaction, command.actor.id);
      assertTenantReference(actor.tenantId, identity.tenantId);
      const target = await requireTargetMembership(transaction, identity);
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
    },
  );
}
