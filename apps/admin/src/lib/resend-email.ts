import { and, eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
} from "resend";

import {
  cmsMembershipInvitations,
  cmsMemberships,
  type EmailDelivery,
} from "@nite/cms-db";
import {
  getOrCreateInvitationEmailDelivery,
  markInvitationEmailDeliveryFailed,
  markInvitationEmailDeliverySent,
  type CmsDatabase,
} from "@nite/editorial";
import { buildInvitationAcceptUrl } from "./invitation-link";
import { buildMembershipInvitationEmail } from "./membership-invitation-email";

type InvitationEmailRequest = {
  from: string;
  to: string;
  subject: string;
  text: string;
  tags: Array<{ name: string; value: string }>;
};

export interface InvitationEmailProvider {
  send(
    input: InvitationEmailRequest,
    options: { idempotencyKey: string },
  ): Promise<{ id: string }>;
}

export class InvitationEmailProviderError extends Error {
  constructor(
    public readonly transient: boolean,
    public readonly failureReason: string,
  ) {
    super(failureReason);
    this.name = "InvitationEmailProviderError";
  }
}

function classifyResendError(statusCode: number | null) {
  const transient =
    statusCode === null ||
    statusCode === 408 ||
    statusCode === 429 ||
    statusCode >= 500;
  const failureReason = statusCode
    ? `Resend rejeitou o envio (HTTP ${statusCode}).`
    : "Resend indisponível temporariamente.";
  return new InvitationEmailProviderError(transient, failureReason);
}

export function createResendInvitationEmailProvider(
  apiKey: string,
): InvitationEmailProvider {
  const resend = new Resend(apiKey);
  return {
    async send(input, options) {
      let response: Awaited<ReturnType<typeof resend.emails.send>>;
      try {
        const payload: CreateEmailOptions = input;
        response = await resend.emails.send(
          payload,
          options satisfies CreateEmailRequestOptions,
        );
      } catch {
        throw classifyResendError(null);
      }
      if (response.error) {
        throw classifyResendError(response.error.statusCode);
      }
      if (!response.data?.id) throw classifyResendError(null);
      return { id: response.data.id };
    },
  };
}

export async function dispatchMembershipInvitationEmail<
  TQueryResult extends PgQueryResultHKT,
>(options: {
  database: CmsDatabase<TQueryResult>;
  outboxEventId: string;
  invitationId: string;
  provider: InvitationEmailProvider;
  configuration: {
    fromEmail: string;
    publicUrl: string;
    invitationLinkSecret: string;
  };
  now?: Date;
}): Promise<{ status: EmailDelivery["status"] | "skipped" }> {
  const [invitation] = await options.database
    .select({
      id: cmsMembershipInvitations.id,
      tenantId: cmsMembershipInvitations.tenantId,
      email: cmsMembershipInvitations.email,
      status: cmsMembershipInvitations.status,
      expiresAt: cmsMembershipInvitations.expiresAt,
      linkNonce: cmsMembershipInvitations.linkNonce,
      inviterDisplayName: cmsMemberships.displayName,
    })
    .from(cmsMembershipInvitations)
    .innerJoin(
      cmsMemberships,
      eq(cmsMemberships.id, cmsMembershipInvitations.invitedByMembershipId),
    )
    .where(
      and(
        eq(cmsMembershipInvitations.id, options.invitationId),
        eq(cmsMembershipInvitations.status, "pending"),
      ),
    )
    .limit(1);
  if (!invitation || invitation.expiresAt <= (options.now ?? new Date())) {
    return { status: "skipped" };
  }

  const delivery = await getOrCreateInvitationEmailDelivery(options.database, {
    outboxEventId: options.outboxEventId,
    invitationId: invitation.id,
    recipientEmail: invitation.email,
  });
  if (delivery.status !== "pending") return { status: delivery.status };

  const acceptUrl = buildInvitationAcceptUrl(
    {
      invitationId: invitation.id,
      tenantId: invitation.tenantId,
      linkNonce: invitation.linkNonce,
      expiresAt: invitation.expiresAt,
    },
    {
      publicUrl: options.configuration.publicUrl,
      secret: options.configuration.invitationLinkSecret,
    },
  );
  const message = buildMembershipInvitationEmail({
    inviterDisplayName: invitation.inviterDisplayName,
    expiresAt: invitation.expiresAt,
    acceptUrl: acceptUrl.href,
  });
  const request: InvitationEmailRequest = {
    from: options.configuration.fromEmail,
    to: invitation.email,
    subject: message.subject,
    text: message.text,
    tags: [{ name: "delivery_id", value: delivery.id }],
  };

  try {
    const result = await options.provider.send(request, {
      idempotencyKey: `membership-invitation/${options.outboxEventId}`,
    });
    const sent = await markInvitationEmailDeliverySent(
      options.database,
      delivery.id,
      result.id,
    );
    return { status: sent.status };
  } catch (error) {
    if (error instanceof InvitationEmailProviderError && !error.transient) {
      const failed = await markInvitationEmailDeliveryFailed(
        options.database,
        delivery.id,
        error.failureReason,
      );
      return { status: failed.status };
    }
    throw error;
  }
}
