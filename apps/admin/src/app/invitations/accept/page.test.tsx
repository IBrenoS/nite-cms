import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  decodeInvitationAcceptanceCookie: vi.fn(),
  getDatabase: vi.fn(),
  readAdminConfiguration: vi.fn(),
  readEmailConfiguration: vi.fn(),
  signInSocial: vi.fn(),
  validateInvitationAcceptance: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@nite/cms-db/database", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/lib/auth-config", () => ({
  readAdminConfiguration: mocks.readAdminConfiguration,
}));
vi.mock("@/lib/email-config", () => ({
  readEmailConfiguration: mocks.readEmailConfiguration,
}));
vi.mock("@/lib/invitation-acceptance", () => ({
  INVITATION_ACCEPTANCE_COOKIE: "nite-cms.invitation-acceptance",
  decodeInvitationAcceptanceCookie: mocks.decodeInvitationAcceptanceCookie,
  validateInvitationAcceptance: mocks.validateInvitationAcceptance,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social: mocks.signInSocial } },
}));

import InvitationAcceptPage from "./page";

describe("página de aceite", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "cookie" })) });
    mocks.decodeInvitationAcceptanceCookie.mockReturnValue({
      invitationId: "10000000-0000-4000-8000-000000000001",
      signature: "a".repeat(43),
    });
    mocks.readAdminConfiguration.mockReturnValue({
      configured: true,
      configuration: { databaseUrl: "postgresql://database.test/nite" },
    });
    mocks.readEmailConfiguration.mockReturnValue({
      configured: true,
      configuration: { invitationLinkSecret: "s".repeat(32) },
    });
    mocks.validateInvitationAcceptance.mockResolvedValue({
      status: "valid",
      invitation: {
        id: "10000000-0000-4000-8000-000000000001",
        inviterDisplayName: "Breno NITE",
        expiresAt: new Date("2026-10-09T12:00:00.000Z"),
      },
    });
    mocks.signInSocial.mockResolvedValue({ error: null });
  });

  it("apresenta o convite formal sem papel e sem iniciar login no carregamento", async () => {
    render(await InvitationAcceptPage());

    expect(screen.getByText(/Breno NITE/)).toBeInTheDocument();
    expect(screen.getByText(/9 de outubro de 2026/)).toBeInTheDocument();
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
    expect(screen.queryByText(/publisher|admin|editorial/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Aceitar convite" }),
    ).toBeInTheDocument();
    expect(mocks.signInSocial).not.toHaveBeenCalled();
  });

  it("inicia o login Microsoft somente após a ação explícita", async () => {
    render(await InvitationAcceptPage());

    fireEvent.click(screen.getByRole("button", { name: "Aceitar convite" }));

    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "microsoft",
      callbackURL: "/invitations/complete",
    });
  });
});
