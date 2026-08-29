import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateMembershipRole: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/app/(workspace)/memberships/actions", () => ({
  createMembership: vi.fn(),
  updateMembershipActive: vi.fn(),
  updateMembershipRole: mocks.updateMembershipRole,
}));

import { MembershipsPanel } from "./memberships-panel";

describe("MembershipsPanel", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.updateMembershipRole.mockReset();
    mocks.updateMembershipRole.mockResolvedValue({ status: "success" });
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
      />,
    );

    fireEvent.change(screen.getByLabelText("Papel de Pessoa Publisher"), {
      target: { value: "admin" },
    });

    await waitFor(() => {
      expect(mocks.updateMembershipRole).toHaveBeenCalledWith({
        objectId: "publisher-oid",
        role: "admin",
      });
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });
  });
});
