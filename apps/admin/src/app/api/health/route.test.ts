import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAdminDatabase: vi.fn(),
}));

vi.mock("@/lib/health", () => ({
  checkAdminDatabase: mocks.checkAdminDatabase,
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  afterEach(() => {
    mocks.checkAdminDatabase.mockReset();
  });

  it("responde ok somente após confirmar o banco", async () => {
    mocks.checkAdminDatabase.mockResolvedValue(undefined);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it.each([
    new Error("Configuração administrativa indisponível."),
    new Error("postgresql://segredo@database.test/nite"),
  ])("responde indisponível sem expor a causa", async (failure) => {
    mocks.checkAdminDatabase.mockRejectedValue(failure);

    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({
      status: "unavailable",
    });
    expect(body).not.toContain(failure.message);
  });
});
