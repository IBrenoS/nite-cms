import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { checkAdminDatabase } from "./health";

const configuredEnvironment = {
  DATABASE_ADMIN_URL: "postgresql://nite_admin@database.test/nite",
  BETTER_AUTH_SECRET: "s".repeat(32),
  BETTER_AUTH_URL: "https://cms.nite.test",
  MICROSOFT_CLIENT_ID: "client-id",
  MICROSOFT_CLIENT_SECRET: "client-secret",
  MICROSOFT_TENANT_ID: "10000000-0000-4000-8000-000000000001",
  CMS_BOOTSTRAP_ADMIN_OID: "20000000-0000-4000-8000-000000000001",
};

describe("readiness do Admin", () => {
  it("consulta o banco configurado antes de declarar disponibilidade", async () => {
    const probeDatabase = vi.fn().mockResolvedValue(undefined);

    await expect(
      checkAdminDatabase({
        environment: configuredEnvironment,
        probeDatabase,
      }),
    ).resolves.toBeUndefined();
    expect(probeDatabase).toHaveBeenCalledWith(
      "postgresql://nite_admin@database.test/nite",
    );
  });

  it("falha fechada sem consultar o banco quando falta configuração", async () => {
    const probeDatabase = vi.fn().mockResolvedValue(undefined);

    await expect(
      checkAdminDatabase({ environment: {}, probeDatabase }),
    ).rejects.toThrow("Configuração administrativa indisponível.");
    expect(probeDatabase).not.toHaveBeenCalled();
  });

  it("propaga indisponibilidade do banco para a rota degradar a readiness", async () => {
    const probeDatabase = vi
      .fn()
      .mockRejectedValue(new Error("postgresql://segredo@database.test/nite"));

    await expect(
      checkAdminDatabase({
        environment: configuredEnvironment,
        probeDatabase,
      }),
    ).rejects.toThrow("postgresql://segredo@database.test/nite");
  });
});
