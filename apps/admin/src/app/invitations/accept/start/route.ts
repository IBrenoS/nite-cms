import { NextResponse } from "next/server";

import { getDatabase } from "@nite/cms-db/database";
import { readAdminConfiguration } from "@/lib/auth-config";
import { readEmailConfiguration } from "@/lib/email-config";
import {
  encodeInvitationAcceptanceCookie,
  INVITATION_ACCEPTANCE_COOKIE,
  validateInvitationAcceptance,
} from "@/lib/invitation-acceptance";

export async function GET(request: Request) {
  const adminConfiguration = readAdminConfiguration(process.env);
  const emailConfiguration = readEmailConfiguration(process.env);
  if (!adminConfiguration.configured || !emailConfiguration.configured) {
    return new Response("Serviço temporariamente indisponível.", {
      status: 503,
    });
  }

  const requestUrl = new URL(request.url);
  const reference = {
    invitationId: requestUrl.searchParams.get("id") ?? "",
    signature: requestUrl.searchParams.get("signature") ?? "",
  };
  const validation = await validateInvitationAcceptance(
    getDatabase(adminConfiguration.configuration),
    reference,
    emailConfiguration.configuration.invitationLinkSecret,
  );
  const cleanUrl = new URL(
    "/invitations/accept",
    emailConfiguration.configuration.publicUrl,
  );
  if (validation.status !== "valid") {
    cleanUrl.searchParams.set("invalid", "1");
    return NextResponse.redirect(cleanUrl);
  }

  const response = NextResponse.redirect(cleanUrl);
  response.cookies.set({
    name: INVITATION_ACCEPTANCE_COOKIE,
    value: encodeInvitationAcceptanceCookie(reference),
    httpOnly: true,
    secure: cleanUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    expires: validation.invitation.expiresAt,
  });
  return response;
}
