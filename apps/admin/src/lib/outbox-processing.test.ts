import { beforeEach, describe, expect, it, vi } from "vitest";

type TestOutboxDispatcher = {
  dispatch(message: {
    id: string;
    topic: string;
    aggregateId: string | null;
    payload: Record<string, unknown>;
    attempts: number;
  }): Promise<void>;
};

const mocks = vi.hoisted(() => {
  const deleteStagingObject = vi.fn();
  return {
    deleteExpiredEditorialPreviewSnapshots: vi.fn(),
    dispatchMembershipInvitationEmail: vi.fn(),
    createResendInvitationEmailProvider: vi.fn(() => ({ send: vi.fn() })),
    getDatabase: vi.fn(() => ({ database: true })),
    deleteStagingObject,
    getMediaObjectStore: vi.fn(() => ({
      store: true,
      deleteStagingObject,
    })),
    purgeDeletingMediaAsset: vi.fn(),
    processOutboxEvents: vi.fn(
      async (database: unknown, dispatcher: TestOutboxDispatcher) => {
        void database;
        void dispatcher;
        return { processed: 0 };
      },
    ),
    readOutboxConfiguration: vi.fn(),
    readEmailConfiguration: vi.fn(),
    scheduleOrphanMediaPurges: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@nite/editorial", () => ({
  deleteExpiredEditorialPreviewSnapshots:
    mocks.deleteExpiredEditorialPreviewSnapshots,
  processOutboxEvents: mocks.processOutboxEvents,
  purgeDeletingMediaAsset: mocks.purgeDeletingMediaAsset,
  scheduleOrphanMediaPurges: mocks.scheduleOrphanMediaPurges,
}));
vi.mock("@nite/cms-db/database", () => ({
  getDatabase: mocks.getDatabase,
}));
vi.mock("./outbox-protocol", () => ({
  readOutboxConfiguration: mocks.readOutboxConfiguration,
}));
vi.mock("./email-config", () => ({
  readEmailConfiguration: mocks.readEmailConfiguration,
}));
vi.mock("./resend-email", () => ({
  createResendInvitationEmailProvider:
    mocks.createResendInvitationEmailProvider,
  dispatchMembershipInvitationEmail: mocks.dispatchMembershipInvitationEmail,
}));
vi.mock("./media-storage", () => ({
  getMediaObjectStore: mocks.getMediaObjectStore,
}));

import { createCmsOutboxDispatcher, processCmsOutbox } from "./outbox";

describe("processamento diário do outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readOutboxConfiguration.mockReturnValue({
      configured: true,
      configuration: {
        databaseUrl: "postgresql://cms.test/database",
      },
    });
    mocks.readEmailConfiguration.mockReturnValue({
      configured: true,
      configuration: {
        apiKey: "re_test_key",
        fromEmail: "CMS NITE <acesso@notify.unijorge.com.br>",
        publicUrl: "https://cms.nite.test",
        invitationLinkSecret: "s".repeat(32),
      },
    });
  });

  it("remove snapshots expirados antes de processar a fila", async () => {
    await expect(processCmsOutbox()).resolves.toEqual({ processed: 0 });

    expect(mocks.deleteExpiredEditorialPreviewSnapshots).toHaveBeenCalledWith({
      database: true,
    });
    expect(
      mocks.deleteExpiredEditorialPreviewSnapshots.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.scheduleOrphanMediaPurges.mock.invocationCallOrder[0]);
    expect(
      mocks.scheduleOrphanMediaPurges.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.processOutboxEvents.mock.invocationCallOrder[0]);
  });

  it("processa mídia e conclui eventos editoriais antigos sem HTTP", async () => {
    const dispatcher = createCmsOutboxDispatcher({
      database: { database: true } as never,
    });
    await dispatcher.dispatch({
      id: "10000000-0000-4000-8000-000000000001",
      topic: "media.asset.purge",
      aggregateId: "20000000-0000-4000-8000-000000000001",
      payload: {},
      attempts: 1,
    });
    expect(mocks.purgeDeletingMediaAsset).toHaveBeenCalledWith(
      { database: true },
      expect.objectContaining({ store: true }),
      { mediaId: "20000000-0000-4000-8000-000000000001" },
    );

    const newsMessage = {
      id: "10000000-0000-4000-8000-000000000002",
      topic: "news.article.unpublished",
      aggregateId: "20000000-0000-4000-8000-000000000002",
      payload: {},
      attempts: 1,
    };
    await dispatcher.dispatch(newsMessage);
    expect(mocks.purgeDeletingMediaAsset).toHaveBeenCalledTimes(1);
  });

  it("remove staging pelo payload mesmo após purge concorrente do registro", async () => {
    const dispatcher = createCmsOutboxDispatcher({
      database: { database: true } as never,
    });
    const mediaId = "20000000-0000-4000-8000-000000000009";
    const stagingObjectKey = `incoming/${mediaId}/original`;

    await dispatcher.dispatch({
      id: "10000000-0000-4000-8000-000000000009",
      topic: "media.staging.purge",
      aggregateId: mediaId,
      payload: { mediaId, stagingObjectKey },
      attempts: 1,
    });

    expect(mocks.deleteStagingObject).toHaveBeenCalledWith(stagingObjectKey);
    expect(mocks.purgeDeletingMediaAsset).not.toHaveBeenCalled();
  });

  it("encaminha somente o tópico de convite ao dispatcher de e-mail", async () => {
    const sendInvitationEmail = vi.fn();
    const dispatcher = createCmsOutboxDispatcher({
      database: { database: true } as never,
      sendInvitationEmail,
    });
    const invitationId = "20000000-0000-4000-8000-000000000020";

    await dispatcher.dispatch({
      id: "10000000-0000-4000-8000-000000000020",
      topic: "membership.invitation.email.requested",
      aggregateId: invitationId,
      payload: { invitationId },
      attempts: 1,
    });
    expect(sendInvitationEmail).toHaveBeenCalledWith({
      outboxEventId: "10000000-0000-4000-8000-000000000020",
      invitationId,
    });

    await expect(
      dispatcher.dispatch({
        id: "10000000-0000-4000-8000-000000000021",
        topic: "unknown.topic",
        aggregateId: invitationId,
        payload: {},
        attempts: 1,
      }),
    ).rejects.toThrow(/não suportado/i);
  });

  it("avalia configuração Resend somente ao consumir evento de convite", async () => {
    mocks.readEmailConfiguration.mockReturnValue({
      configured: false,
      issues: [{ field: "RESEND_API_KEY", reason: "missing" }],
    });
    mocks.processOutboxEvents.mockImplementation(
      async (_database, dispatcher) => {
        await dispatcher.dispatch({
          id: "10000000-0000-4000-8000-000000000022",
          topic: "news.article.published",
          aggregateId: "20000000-0000-4000-8000-000000000022",
          payload: {},
          attempts: 1,
        });
        return { processed: 1 };
      },
    );

    await expect(processCmsOutbox()).resolves.toEqual({ processed: 1 });
    expect(mocks.readEmailConfiguration).not.toHaveBeenCalled();
  });

  it("monta o envio Resend de forma lazy ao consumir o convite", async () => {
    const invitationId = "20000000-0000-4000-8000-000000000023";
    mocks.processOutboxEvents.mockImplementation(
      async (_database, dispatcher) => {
        await dispatcher.dispatch({
          id: "10000000-0000-4000-8000-000000000023",
          topic: "membership.invitation.email.requested",
          aggregateId: invitationId,
          payload: { invitationId },
          attempts: 1,
        });
        return { processed: 1 };
      },
    );

    await expect(processCmsOutbox()).resolves.toEqual({ processed: 1 });
    expect(mocks.readEmailConfiguration).toHaveBeenCalledOnce();
    expect(mocks.dispatchMembershipInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        database: { database: true },
        outboxEventId: "10000000-0000-4000-8000-000000000023",
        invitationId,
        provider: expect.objectContaining({ send: expect.any(Function) }),
      }),
    );
  });
});
