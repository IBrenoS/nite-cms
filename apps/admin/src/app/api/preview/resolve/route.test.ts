import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  readAdminConfiguration: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@nite/cms-db/database", () => ({
  getDatabase: mocks.getDatabase,
}));
vi.mock("@/lib/auth-config", () => ({
  readAdminConfiguration: mocks.readAdminConfiguration,
}));

import { POST } from "./route";

describe("POST /api/preview/resolve", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.getDatabase.mockReset();
    mocks.readAdminConfiguration.mockReset();
  });

  it("responde 503 sem inicializar o banco quando o preview está desconfigurado", async () => {
    vi.stubEnv("PREVIEW_HMAC_SECRET", "x".repeat(32));
    vi.stubEnv("PORTAL_PREVIEW_URL", "");

    const response = await POST(
      new Request("https://cms.nite.test/api/preview/resolve", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      error: "preview_unavailable",
    });
    expect(mocks.readAdminConfiguration).not.toHaveBeenCalled();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
});
