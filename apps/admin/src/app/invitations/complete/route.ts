import { NextResponse } from "next/server";

import {
  CmsAuthorizationError,
  resolveCmsMembership,
} from "@nite/editorial";
import { getAuthenticatedEntraContext } from "@/lib/auth";
import { readEmailConfiguration } from "@/lib/email-config";
import {
  decodeInvitationAcceptanceCookie,
  INVITATION_ACCEPTANCE_COOKIE,
  validateInvitationAcceptance,
} from "@/lib/invitation-acceptance";

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function clearAcceptanceCookie(response: NextResponse, secure: boolean) {
  response.cookies.set({
    name: INVITATION_ACCEPTANCE_COOKIE,
    value: "",
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

function invalidAcceptanceResponse(publicUrl: string) {
  const url = new URL("/invitations/accept", publicUrl);
  url.searchParams.set("invalid", "1");
  return clearAcceptanceCookie(
    NextResponse.redirect(url),
    url.protocol === "https:",
  );
}

export async function GET(request: Request) {
  const emailConfiguration = readEmailConfiguration(process.env);
  if (!emailConfiguration.configured) {
    return new Response("Serviço temporariamente indisponível.", {
      status: 503,
    });
  }
  const { publicUrl, invitationLinkSecret } =
    emailConfiguration.configuration;
  const reference = decodeInvitationAcceptanceCookie(
    readCookie(request, INVITATION_ACCEPTANCE_COOKIE),
  );
  if (!reference) return invalidAcceptanceResponse(publicUrl);

  const identityContext = await getAuthenticatedEntraContext();
  if (identityContext.status === "unconfigured") {
    return new Response("Serviço temporariamente indisponível.", {
      status: 503,
    });
  }
  if (identityContext.status !== "authenticated") {
    return invalidAcceptanceResponse(publicUrl);
  }

  try {
    const validation = await validateInvitationAcceptance(
      identityContext.database,
      reference,
      invitationLinkSecret,
    );
    if (validation.status !== "valid") {
      return invalidAcceptanceResponse(publicUrl);
    }

    await resolveCmsMembership(
      identityContext.database,
      identityContext.identity,
      {
        tenantId: identityContext.configuration.tenantId,
        adminObjectId:
          identityContext.configuration.bootstrapAdminObjectId,
      },
      { invitationId: reference.invitationId },
    );

    const destination = new URL("/", publicUrl);
    return clearAcceptanceCookie(
      NextResponse.redirect(destination),
      destination.protocol === "https:",
    );
  } catch (error) {
    if (error instanceof CmsAuthorizationError) {
      return invalidAcceptanceResponse(publicUrl);
    }
    return new Response("Serviço temporariamente indisponível.", {
      status: 503,
    });
  }
}
