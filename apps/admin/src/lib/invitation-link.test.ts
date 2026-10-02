import { describe, expect, it } from "vitest";

import {
  buildInvitationAcceptUrl,
  createInvitationSignature,
  verifyInvitationSignature,
  type InvitationLinkClaims,
} from "./invitation-link";

const claims: InvitationLinkClaims = {
  invitationId: "10000000-0000-4000-8000-000000000001",
  tenantId: "20000000-0000-4000-8000-000000000001",
  linkNonce: "30000000-0000-4000-8000-000000000001",
  expiresAt: new Date("2026-10-09T12:00:00.000Z"),
};
const secret = "convite-secreto-com-pelo-menos-32-bytes";

describe("links assinados de convite", () => {
  it("produz assinatura estável e URL pública sem expor claims internos", () => {
    const signature = createInvitationSignature(claims, secret);

    expect(createInvitationSignature(claims, secret)).toBe(signature);
    expect(verifyInvitationSignature(claims, signature, secret)).toBe(true);

    const url = buildInvitationAcceptUrl(claims, {
      publicUrl: "https://cms.nite.test",
      secret,
    });
    expect(url.href).toBe(
      `https://cms.nite.test/invitations/accept/start?id=${claims.invitationId}&signature=${signature}`,
    );
    expect(url.href).not.toContain(claims.linkNonce);
    expect(url.href).not.toContain(claims.tenantId);
  });

  it.each([
    ["invitationId", { ...claims, invitationId: "10000000-0000-4000-8000-000000000002" }],
    ["tenantId", { ...claims, tenantId: "20000000-0000-4000-8000-000000000002" }],
    ["linkNonce", { ...claims, linkNonce: "30000000-0000-4000-8000-000000000002" }],
    ["expiresAt", { ...claims, expiresAt: new Date("2026-10-09T12:00:01.000Z") }],
  ] as const)("rejeita assinatura quando %s muda", (_field, changedClaims) => {
    const signature = createInvitationSignature(claims, secret);
    expect(verifyInvitationSignature(changedClaims, signature, secret)).toBe(
      false,
    );
  });

  it("rejeita assinatura malformada sem erro de tamanho na comparação", () => {
    expect(verifyInvitationSignature(claims, "curta", secret)).toBe(false);
    expect(verifyInvitationSignature(claims, "", secret)).toBe(false);
  });

  it("rejeita secret curto e origem com credenciais", () => {
    expect(() => createInvitationSignature(claims, "curto")).toThrow();
    expect(() =>
      buildInvitationAcceptUrl(claims, {
        publicUrl: "https://usuario:senha@cms.nite.test",
        secret,
      }),
    ).toThrow();
  });
});
