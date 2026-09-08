import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replaceMembershipInvitation: vi.fn(),
  revokeMembershipInvitation: vi.fn(),
  updateMembershipRole: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/app/(workspace)/memberships/actions", () => ({
  createMembershipInvitation: vi.fn(),
  replaceMembershipInvitation: mocks.replaceMembershipInvitation,
  revokeMembershipInvitation: mocks.revokeMembershipInvitation,
  updateMembershipActive: vi.fn(),
  updateMembershipRole: mocks.updateMembershipRole,
}));

import { MembershipsPanel } from "./memberships-panel";

describe("MembershipsPanel", () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.updateMembershipRole.mockReset();
    mocks.updateMembershipRole.mockResolvedValue({ status: "success" });
    mocks.replaceMembershipInvitation.mockReset();
    mocks.replaceMembershipInvitation.mockResolvedValue({ status: "success" });
    mocks.revokeMembershipInvitation.mockReset();
    mocks.revokeMembershipInvitation.mockResolvedValue({ status: "success" });
  });

  it("atualiza a leitura do servidor após trocar um papel", async () => {
    render(
      <MembershipsPanel
        memberships={[
          {
            id: "10000000-0000-4000-8000-000000000001",
            objectId: "publisher-oid",
            displayName: "Pessoa Publisher",
            email: "publisher@nite.test",
            role: "publisher",
            active: true,
          },
        ]}
        invitations={[]}
        currentMembershipId="outro-id"
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Nível de acesso de Pessoa Publisher"),
      {
        target: { value: "admin" },
      },
    );

    await waitFor(() => {
      expect(mocks.updateMembershipRole).toHaveBeenCalledWith({
        objectId: "publisher-oid",
        role: "admin",
      });
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });
  });

  it("não oferece alteração da própria conta administrativa", () => {
    render(
      <MembershipsPanel
        memberships={[
          {
            id: "10000000-0000-4000-8000-000000000001",
            objectId: "admin-oid",
            displayName: "Pessoa Administradora",
            email: "admin@unijorge.com",
            role: "admin",
            active: true,
          },
        ]}
        invitations={[]}
        currentMembershipId="10000000-0000-4000-8000-000000000001"
      />,
    );

    expect(screen.getByText("Você")).toBeInTheDocument();
    expect(screen.getByText("Conta atual")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Nível de acesso de Pessoa Administradora"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Object ID")).not.toBeInTheDocument();
  });

  it("exibe e aciona correção e revogação somente por e-mail", async () => {
    render(
      <MembershipsPanel
        memberships={[]}
        invitations={[
          {
            id: "30000000-0000-4000-8000-000000000001",
            email: "convidada@unijorge.com",
            role: "publisher",
            status: "pending",
            expiresAt: "2099-09-14T12:00:00.000Z",
            expired: false,
          },
        ]}
        currentMembershipId="10000000-0000-4000-8000-000000000001"
      />,
    );

    expect(screen.getByLabelText("E-mail institucional")).toBeRequired();
    expect(screen.getByText("convidada@unijorge.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Corrigir" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revogar" })).toBeInTheDocument();
    expect(screen.queryByText("Object ID")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Corrigir" }));
    const form = screen.getByRole("form", {
      name: "Corrigir convite de convidada@unijorge.com",
    });
    fireEvent.change(within(form).getByLabelText("E-mail institucional"), {
      target: { value: "corrigida@unijorge.com" },
    });
    fireEvent.click(
      within(form).getByRole("button", { name: "Substituir convite" }),
    );
    await waitFor(() =>
      expect(mocks.replaceMembershipInvitation).toHaveBeenCalledWith({
        invitationId: "30000000-0000-4000-8000-000000000001",
        email: "corrigida@unijorge.com",
        role: "publisher",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("form", {
          name: "Corrigir convite de convidada@unijorge.com",
        }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Revogar" }));
    await waitFor(() =>
      expect(mocks.revokeMembershipInvitation).toHaveBeenCalledWith({
        invitationId: "30000000-0000-4000-8000-000000000001",
      }),
    );
  });
});
