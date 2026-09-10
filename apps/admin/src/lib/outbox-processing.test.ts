import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWebRevalidationDispatcher: vi.fn(() => ({ dispatch: vi.fn() })),
  deleteExpiredEditorialPreviewSnapshots: vi.fn(),
  getDatabase: vi.fn(() => ({ database: true })),
  getMediaObjectStore: vi.fn(() => ({ store: true })),
  purgeDeletingMediaAsset: vi.fn(),
  processOutboxEvents: vi.fn(async () => ({ processed: 0 })),
  readOutboxConfiguration: vi.fn(),
  scheduleOrphanMediaPurges: vi.fn(),
}));

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
  createWebRevalidationDispatcher: mocks.createWebRevalidationDispatcher,
  readOutboxConfiguration: mocks.readOutboxConfiguration,
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
        revalidationUrl: "https://nite.test/api/revalidate/news",
        revalidationSecret: "x".repeat(32),
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

  it("processa purge de mídia internamente e encaminha news ao Portal", async () => {
    const webDispatch = vi.fn();
    const dispatcher = createCmsOutboxDispatcher({
      database: { database: true } as never,
      webDispatcher: { dispatch: webDispatch },
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
      { store: true },
      { mediaId: "20000000-0000-4000-8000-000000000001" },
    );
    expect(webDispatch).not.toHaveBeenCalled();

    const newsMessage = {
      id: "10000000-0000-4000-8000-000000000002",
      topic: "news.article.unpublished",
      aggregateId: "20000000-0000-4000-8000-000000000002",
      payload: {},
      attempts: 1,
    };
    await dispatcher.dispatch(newsMessage);
    expect(webDispatch).toHaveBeenCalledWith(newsMessage);
  });
});
