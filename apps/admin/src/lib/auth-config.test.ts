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
          tenantId: "tenant-nite",
          bootstrapAdminObjectId: "admin-oid",
        },
        {
          accountId: "member-oid",
          providerId: "microsoft",
        },
        {
          name: "Pessoa Editora",
          email: "editora@nite.test",
        },
      ),
    ).toEqual({
      tenantId: "tenant-nite",
      objectId: "member-oid",
      displayName: "Pessoa Editora",
      email: "editora@nite.test",
    });
  });
});
