import { describe, expect, it } from "vitest";

import { readApiConfiguration } from "./configuration";

describe("configuração isolada da API pública", () => {
  it("aceita somente leitura PostgreSQL e mídia HTTP", () => {
    expect(
      readApiConfiguration({
        DATABASE_PUBLIC_URL: "postgresql://nite_public@database.test/nite",
        R2_PUBLIC_BASE_URL: "https://media.nite.test/",
      }),
    ).toEqual({
      databaseUrl: "postgresql://nite_public@database.test/nite",
      mediaBaseUrl: "https://media.nite.test/",
    });
  });

  it("não conhece secrets administrativos", () => {
    expect(() =>
      readApiConfiguration({
        DATABASE_ADMIN_URL: "postgresql://nite_admin@database.test/nite",
        BETTER_AUTH_SECRET: "segredo-que-nao-pertence-a-api-publica",
      }),
    ).toThrow(/DATABASE_PUBLIC_URL/);
  });
});
