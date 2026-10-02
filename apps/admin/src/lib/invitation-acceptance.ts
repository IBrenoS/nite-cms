import { eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  cmsMembershipInvitations,
  cmsMemberships,
} from "@nite/cms-db";
import type { CmsDatabase } from "@nite/editorial";
import { verifyInvitationSignature } from "./invitation-link";

export const INVITATION_ACCEPTANCE_COOKIE =
  "nite-cms.invitation-acceptance";

export type InvitationAcceptanceReference = {
  invitationId: string;
  signature: string;
};

export type ValidInvitationAcceptance = {
  status: "valid";
  invitation: {
    id: string;
    expiresAt: Date;
    inviterDisplayName: string;
  };
};

export type InvitationAcceptanceResult =
  | ValidInvitationAcceptance
  | { status: "invalid" | "revoked" | "expired" };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const signaturePattern = /^[A-Za-z0-9_-]{43}$/u;

export function encodeInvitationAcceptanceCookie(
  reference: InvitationAcceptanceReference,
): string {
  return Buffer.from(JSON.stringify(reference), "utf8").toString("base64url");
}

export function decodeInvitationAcceptanceCookie(
  value: string | undefined,
): InvitationAcceptanceReference | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("invitationId" in parsed) ||
      !("signature" in parsed) ||
      typeof parsed.invitationId !== "string" ||
      typeof parsed.signature !== "string" ||
      !uuidPattern.test(parsed.invitationId) ||
      !signaturePattern.test(parsed.signature)
    ) {
      return undefined;
    }
    return {
      invitationId: parsed.invitationId,
      signature: parsed.signature,
    };
  } catch {
    return undefined;
  }
}

export async function validateInvitationAcceptance<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  reference: InvitationAcceptanceReference,
  invitationLinkSecret: string,
  now = new Date(),
): Promise<InvitationAcceptanceResult> {
  if (
    !uuidPattern.test(reference.invitationId) ||
    !signaturePattern.test(reference.signature)
  ) {
    return { status: "invalid" };
  }

  const [record] = await database
    .select({
      id: cmsMembershipInvitations.id,
      tenantId: cmsMembershipInvitations.tenantId,
      linkNonce: cmsMembershipInvitations.linkNonce,
      expiresAt: cmsMembershipInvitations.expiresAt,
      status: cmsMembershipInvitations.status,
      inviterDisplayName: cmsMemberships.displayName,
    })
    .from(cmsMembershipInvitations)
    .innerJoin(
      cmsMemberships,
      eq(
        cmsMemberships.id,
        cmsMembershipInvitations.invitedByMembershipId,
      ),
    )
    .where(eq(cmsMembershipInvitations.id, reference.invitationId))
    .limit(1);
  if (!record) return { status: "invalid" };

  const signatureValid = verifyInvitationSignature(
    {
      invitationId: record.id,
      tenantId: record.tenantId,
      linkNonce: record.linkNonce,
      expiresAt: record.expiresAt,
    },
    reference.signature,
    invitationLinkSecret,
  );
  if (!signatureValid) return { status: "invalid" };
  if (record.status !== "pending") return { status: "revoked" };
  if (record.expiresAt <= now) return { status: "expired" };

  return {
    status: "valid",
    invitation: {
      id: record.id,
      expiresAt: record.expiresAt,
      inviterDisplayName: record.inviterDisplayName,
    },
  };
}
