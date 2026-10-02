import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  readAdminConfiguration: vi.fn(),
  readEmailConfiguration: vi.fn(),
  validateInvitationAcceptance: vi.fn(),
}));

vi.mock("@nite/cms-db/database", () => ({
  getDatabase: mocks.getDatabase,
}));
vi.mock("@/lib/auth-config", () => ({
  readAdminConfiguration: mocks.readAdminConfiguration,
}));
vi.mock("@/lib/email-config", () => ({
  readEmailConfiguration: mocks.readEmailConfiguration,
}));
vi.mock("@/lib/invitation-acceptance", () => ({
  INVITATION_ACCEPTANCE_COOKIE: "nite-cms.invitation-acceptance",
  encodeInvitationAcceptanceCookie: ({ invitationId, signature }: { invitationId: string; signature: string }) =>
    `${invitationId}.${signature}`,
  validateInvitationAcceptance: mocks.validateInvitationAcceptance,
}));

import { GET } from "./route";

describe("início público do aceite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readEmailConfiguration.mockReturnValue({
      configured: true,
      configuration: {
        publicUrl: "https://cms.nite.test",
        invitationLinkSecret: "s".repeat(32),
      },
    });
    mocks.readAdminConfiguration.mockReturnValue({
      configured: true,
      configuration: { databaseUrl: "postgresql://database.test/nite" },
    });
    mocks.getDatabase.mockReturnValue({ database: true });
  });

  it("somente registra o contexto e redireciona para a URL limpa", async () => {
    const expiresAt = new Date("2026-10-09T12:00:00.000Z");
    mocks.validateInvitationAcceptance.mockResolvedValue({
      status: "valid",
      invitation: {
        id: "10000000-0000-4000-8000-000000000001",
        expiresAt,
        inviterDisplayName: "Breno NITE",
      },
    });

    const response = await GET(
      new Request(
        "https://cms.nite.test/invitations/accept/start?id=10000000-0000-4000-8000-000000000001&signature=assinatura",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://cms.nite.test/invitations/accept",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "nite-cms.invitation-acceptance=10000000-0000-4000-8000-000000000001.assinatura",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(mocks.validateInvitationAcceptance).toHaveBeenCalledOnce();
  });

  it.each(["invalid", "revoked", "expired"])(
    "redireciona %s sem criar cookie",
    async (status) => {
      mocks.validateInvitationAcceptance.mockResolvedValue({ status });

      const response = await GET(
        new Request(
          "https://cms.nite.test/invitations/accept/start?id=10000000-0000-4000-8000-000000000001&signature=assinatura",
        ),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://cms.nite.test/invitations/accept?invalid=1",
      );
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );
});
