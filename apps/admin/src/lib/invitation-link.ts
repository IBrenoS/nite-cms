import { createHmac, timingSafeEqual } from "node:crypto";

export type InvitationLinkClaims = {
  invitationId: string;
  tenantId: string;
  linkNonce: string;
  expiresAt: Date;
};

export type InvitationLinkConfiguration = {
  publicUrl: string;
  secret: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertSecret(secret: string) {
  if (!secret.trim() || Buffer.byteLength(secret, "utf8") < 32) {
    throw new TypeError("Invitation link secret inválido.");
  }
}

function canonicalizeClaims(input: InvitationLinkClaims): string {
  if (
    !uuidPattern.test(input.invitationId) ||
    !uuidPattern.test(input.tenantId) ||
    !uuidPattern.test(input.linkNonce) ||
    Number.isNaN(input.expiresAt.getTime())
  ) {
    throw new TypeError("Claims do convite inválidos.");
  }
  return [
    "cms-invitation-v1",
    input.invitationId.toLowerCase(),
    input.tenantId.toLowerCase(),
    input.linkNonce.toLowerCase(),
    input.expiresAt.toISOString(),
  ].join("\n");
}

function parsePublicOrigin(value: string): URL {
  const url = new URL(value);
  const localDevelopment = url.hostname === "localhost";
  if (
    (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new TypeError("Origem pública do CMS inválida.");
  }
  return url;
}

export function createInvitationSignature(
  input: InvitationLinkClaims,
  secret: string,
): string {
  assertSecret(secret);
  return createHmac("sha256", secret)
    .update(canonicalizeClaims(input), "utf8")
    .digest("base64url");
}

export function verifyInvitationSignature(
  input: InvitationLinkClaims,
  signature: string,
  secret: string,
): boolean {
  try {
    const expected = Buffer.from(
      createInvitationSignature(input, secret),
      "base64url",
    );
    const received = Buffer.from(signature, "base64url");
    return received.length === expected.length && timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

export function buildInvitationAcceptUrl(
  input: InvitationLinkClaims,
  configuration: InvitationLinkConfiguration,
): URL {
  const publicOrigin = parsePublicOrigin(configuration.publicUrl);
  const url = new URL("/invitations/accept/start", publicOrigin);
  url.searchParams.set("id", input.invitationId);
  url.searchParams.set(
    "signature",
    createInvitationSignature(input, configuration.secret),
  );
  return url;
}
