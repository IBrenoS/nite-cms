import { describe, expect, it } from "vitest";

import { readAdminConfiguration, toEntraIdentity } from "./auth-config";

describe("configuração administrativa", () => {
  it("expõe somente os nomes das variáveis ausentes", () => {
    expect(readAdminConfiguration({})).toEqual({
      configured: false,
      missing: [
        "DATABASE_ADMIN_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "MICROSOFT_CLIENT_ID",
        "MICROSOFT_CLIENT_SECRET",
        "MICROSOFT_TENANT_ID",
        "CMS_BOOTSTRAP_ADMIN_OID",
      ],
    });
  });

  it("forma a identidade editorial pelo tenant configurado e accountId verificado", () => {
    expect(
      toEntraIdentity(
        {
          tenantId: "10000000-0000-4000-8000-000000000001",
          bootstrapAdminObjectId: "20000000-0000-4000-8000-000000000001",
        },
        {
          accountId: "20000000-0000-4000-8000-000000000002",
          providerId: "microsoft",
          issuer:
            "https://login.microsoftonline.com/10000000-0000-4000-8000-000000000001/v2.0",
        },
        {
          name: "Pessoa Editora",
          email: "editora@nite.test",
        },
      ),
    ).toEqual({
      tenantId: "10000000-0000-4000-8000-000000000001",
      objectId: "20000000-0000-4000-8000-000000000002",
      displayName: "Pessoa Editora",
      email: "editora@nite.test",
    });
  });

  it("recusa issuer, provider ou oid que não correspondem ao tenant", () => {
    const configuration = {
      tenantId: "10000000-0000-4000-8000-000000000001",
      bootstrapAdminObjectId: "20000000-0000-4000-8000-000000000001",
    };
    const user = { name: "Pessoa", email: "pessoa@unijorge.com" };

    expect(() =>
      toEntraIdentity(
        configuration,
        {
          accountId: "20000000-0000-4000-8000-000000000002",
          providerId: "microsoft",
          issuer: "https://login.microsoftonline.com/outro/v2.0",
        },
        user,
      ),
    ).toThrow();
  });
});
