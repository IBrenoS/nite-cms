import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membershipsPanel: vi.fn(
    ({ invitations }: { invitations: Array<{ deliveryStatus?: string }> }) => (
      <div data-testid="membership-invitations">
        {JSON.stringify(invitations)}
      </div>
    ),
  ),
  requireCmsPageContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireCmsPageContext: mocks.requireCmsPageContext,
}));
vi.mock("@/components/memberships-panel", () => ({
  MembershipsPanel: mocks.membershipsPanel,
}));
vi.mock("@/components/memberships/membership-invite-dialog", () => ({
  MembershipInviteDialog: () => <button>Convidar pessoa</button>,
}));

import MembershipsPage from "./page";

describe("página Equipe e acessos", () => {
  afterEach(cleanup);

  it("nega publisher antes de consultar membros ou convites", async () => {
    const select = vi.fn();
    mocks.requireCmsPageContext.mockResolvedValue({
      membership: {
        id: "10000000-0000-4000-8000-000000000001",
        tenantId: "20000000-0000-4000-8000-000000000001",
        role: "publisher",
      },
      database: { select },
    });

    render(await MembershipsPage());

    expect(
      screen.getByRole("heading", { name: "Acesso negado" }),
    ).toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
  });

  it("associa a entrega ao convite e repassa o status ao painel", async () => {
    const membershipsQuery = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    membershipsQuery.from.mockReturnValue(membershipsQuery);
    membershipsQuery.where.mockReturnValue(membershipsQuery);
    const invitationsQuery = {
      from: vi.fn(),
      leftJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn().mockResolvedValue([
        {
          id: "30000000-0000-4000-8000-000000000001",
          tenantId: "20000000-0000-4000-8000-000000000001",
          email: "convidada@unijorge.com.br",
          role: "publisher",
          status: "pending",
          expiresAt: new Date("2026-10-09T12:00:00.000Z"),
          expired: false,
          deliveryStatus: "delivered",
        },
      ]),
    };
    invitationsQuery.from.mockReturnValue(invitationsQuery);
    invitationsQuery.leftJoin.mockReturnValue(invitationsQuery);
    invitationsQuery.where.mockReturnValue(invitationsQuery);
    const select = vi
      .fn()
      .mockReturnValueOnce(membershipsQuery)
      .mockReturnValueOnce(invitationsQuery);
    mocks.requireCmsPageContext.mockResolvedValue({
      membership: {
        id: "10000000-0000-4000-8000-000000000001",
        tenantId: "20000000-0000-4000-8000-000000000001",
        role: "admin",
      },
      database: { select },
    });

    render(await MembershipsPage());

    expect(invitationsQuery.leftJoin).toHaveBeenCalledOnce();
    expect(screen.getByTestId("membership-invitations")).toHaveTextContent(
      '"deliveryStatus":"delivered"',
    );
  });
});
