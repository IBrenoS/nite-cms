import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWebRevalidationDispatcher: vi.fn(() => ({ dispatch: vi.fn() })),
  deleteExpiredEditorialPreviewSnapshots: vi.fn(),
  getDatabase: vi.fn(() => ({ database: true })),
  processOutboxEvents: vi.fn(async () => ({ processed: 0 })),
  readOutboxConfiguration: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@nite/editorial", () => ({
  deleteExpiredEditorialPreviewSnapshots:
    mocks.deleteExpiredEditorialPreviewSnapshots,
  processOutboxEvents: mocks.processOutboxEvents,
}));
vi.mock("@nite/cms-db/database", () => ({
  getDatabase: mocks.getDatabase,
}));
vi.mock("./outbox-protocol", () => ({
  createWebRevalidationDispatcher: mocks.createWebRevalidationDispatcher,
  readOutboxConfiguration: mocks.readOutboxConfiguration,
}));

import { processCmsOutbox } from "./outbox";

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
    ).toBeLessThan(mocks.processOutboxEvents.mock.invocationCallOrder[0]);
  });
});
