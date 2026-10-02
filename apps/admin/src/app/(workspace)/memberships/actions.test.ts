import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCmsMembershipInvitation: vi.fn(),
  processCmsOutbox: vi.fn(),
  replaceCmsMembershipInvitation: vi.fn(),
  requireCmsContext: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({
  requireCmsContext: mocks.requireCmsContext,
}));
vi.mock("@/lib/outbox", () => ({
  processCmsOutbox: mocks.processCmsOutbox,
}));
vi.mock("@nite/editorial", () => ({
  CmsAuthorizationError: class CmsAuthorizationError extends Error {},
  CmsMembershipInvitationError: class CmsMembershipInvitationError extends Error {},
  CmsMembershipManagementError: class CmsMembershipManagementError extends Error {},
  changeCmsMembershipRole: vi.fn(),
  createCmsMembershipInvitation: mocks.createCmsMembershipInvitation,
  replaceCmsMembershipInvitation: mocks.replaceCmsMembershipInvitation,
  revokeCmsMembershipInvitation: vi.fn(),
  setCmsMembershipActive: vi.fn(),
}));

import {
  createMembershipInvitation,
  replaceMembershipInvitation,
} from "./actions";

describe("ações de convite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCmsContext.mockResolvedValue({
      database: { database: true },
      membership: { id: "membership-id" },
    });
    mocks.createCmsMembershipInvitation.mockResolvedValue({ id: "invite-id" });
    mocks.replaceCmsMembershipInvitation.mockResolvedValue({
      id: "invite-id-2",
    });
    mocks.processCmsOutbox.mockResolvedValue({ processed: 1 });
  });

  it("tenta processar após o commit e antes de revalidar", async () => {
    const formData = new FormData();
    formData.set("email", "pessoa@unijorge.com.br");
    formData.set("role", "publisher");

    await expect(
      createMembershipInvitation({ status: "idle" }, formData),
    ).resolves.toEqual({
      status: "success",
      message: "Convite criado por 7 dias.",
    });
    expect(mocks.createCmsMembershipInvitation).toHaveBeenCalledOnce();
    expect(mocks.processCmsOutbox).toHaveBeenCalledOnce();
    expect(
      mocks.createCmsMembershipInvitation.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.processCmsOutbox.mock.invocationCallOrder[0]);
    expect(mocks.processCmsOutbox.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.revalidatePath.mock.invocationCallOrder[0],
    );
  });

  it("mantém sucesso quando o processamento imediato falha", async () => {
    mocks.processCmsOutbox.mockRejectedValue(new Error("resend unavailable"));

    await expect(
      replaceMembershipInvitation({
        invitationId: "10000000-0000-4000-8000-000000000001",
        email: "pessoa@unijorge.com.br",
        role: "admin",
      }),
    ).resolves.toEqual({ status: "success" });
    expect(mocks.processCmsOutbox).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/memberships");
  });

  it("não processa outbox quando a criação do convite falha", async () => {
    mocks.createCmsMembershipInvitation.mockRejectedValue(
      new Error("create failed"),
    );
    const formData = new FormData();
    formData.set("email", "pessoa@unijorge.com.br");
    formData.set("role", "publisher");

    await expect(
      createMembershipInvitation({ status: "idle" }, formData),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.processCmsOutbox).not.toHaveBeenCalled();
  });
});
