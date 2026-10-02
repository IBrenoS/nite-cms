import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decodeInvitationAcceptanceCookie: vi.fn(),
  getAuthenticatedEntraContext: vi.fn(),
  readEmailConfiguration: vi.fn(),
  resolveCmsMembership: vi.fn(),
  validateInvitationAcceptance: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedEntraContext: mocks.getAuthenticatedEntraContext,
}));
vi.mock("@/lib/email-config", () => ({
  readEmailConfiguration: mocks.readEmailConfiguration,
}));
vi.mock("@/lib/invitation-acceptance", () => ({
  INVITATION_ACCEPTANCE_COOKIE: "nite-cms.invitation-acceptance",
  decodeInvitationAcceptanceCookie: mocks.decodeInvitationAcceptanceCookie,
  validateInvitationAcceptance: mocks.validateInvitationAcceptance,
}));
vi.mock("@nite/editorial", () => {
  class CmsAuthorizationError extends Error {}
  return {
    CmsAuthorizationError,
    resolveCmsMembership: mocks.resolveCmsMembership,
  };
});

import { CmsAuthorizationError } from "@nite/editorial";
import { GET } from "./route";

const invitationId = "10000000-0000-4000-8000-000000000001";
const reference = { invitationId, signature: "a".repeat(43) };
const authenticatedContext = {
  status: "authenticated" as const,
  database: { database: true },
  configuration: {
    tenantId: "20000000-0000-4000-8000-000000000001",
    bootstrapAdminObjectId: "30000000-0000-4000-8000-000000000001",
  },
  identity: {
    tenantId: "20000000-0000-4000-8000-000000000001",
    objectId: "40000000-0000-4000-8000-000000000001",
    displayName: "Pessoa Convidada",
    email: "pessoa@unijorge.com.br",
  },
};

function request() {
  return new Request("https://cms.nite.test/invitations/complete", {
    headers: {
      cookie: "nite-cms.invitation-acceptance=cookie-value",
    },
  });
}

describe("conclusão autenticada do convite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decodeInvitationAcceptanceCookie.mockReturnValue(reference);
    mocks.getAuthenticatedEntraContext.mockResolvedValue(authenticatedContext);
    mocks.readEmailConfiguration.mockReturnValue({
      configured: true,
      configuration: {
        publicUrl: "https://cms.nite.test",
        invitationLinkSecret: "s".repeat(32),
      },
    });
    mocks.validateInvitationAcceptance.mockResolvedValue({
      status: "valid",
      invitation: { id: invitationId },
    });
    mocks.resolveCmsMembership.mockResolvedValue({ id: "membership-id" });
  });

  it("aceita com a identidade autenticada, limpa o cookie e redireciona", async () => {
    const response = await GET(request());

    expect(mocks.resolveCmsMembership).toHaveBeenCalledWith(
      authenticatedContext.database,
      authenticatedContext.identity,
      {
        tenantId: authenticatedContext.configuration.tenantId,
        adminObjectId:
          authenticatedContext.configuration.bootstrapAdminObjectId,
      },
      { invitationId },
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://cms.nite.test/");
    expect(response.headers.get("set-cookie")).toContain(
      "nite-cms.invitation-acceptance=",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
  });

  it("remove o contexto quando não existe sessão", async () => {
    mocks.getAuthenticatedEntraContext.mockResolvedValue({
      status: "anonymous",
    });

    const response = await GET(request());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/invitations/accept?invalid=1",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
    expect(mocks.resolveCmsMembership).not.toHaveBeenCalled();
  });

  it.each(["invalid", "revoked", "expired"])(
    "remove o contexto quando o convite está %s",
    async (status) => {
      mocks.validateInvitationAcceptance.mockResolvedValue({ status });

      const response = await GET(request());

      expect(response.status).toBe(307);
      expect(response.headers.get("set-cookie")).toContain(
        "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      );
      expect(mocks.resolveCmsMembership).not.toHaveBeenCalled();
    },
  );

  it("remove o contexto quando o e-mail autenticado não corresponde", async () => {
    mocks.resolveCmsMembership.mockRejectedValue(new CmsAuthorizationError());

    const response = await GET(request());

    expect(response.status).toBe(307);
    expect(response.headers.get("set-cookie")).toContain(
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
  });

  it("preserva o contexto e responde 503 em falha transitória", async () => {
    mocks.resolveCmsMembership.mockRejectedValue(
      new Error("database temporarily unavailable"),
    );

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
