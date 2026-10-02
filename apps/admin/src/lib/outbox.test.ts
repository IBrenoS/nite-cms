import { describe, expect, it } from "vitest";

import {
  readOutboxConfiguration,
  verifyCronAuthorization,
} from "./outbox-protocol";

describe("configuração do outbox", () => {
  it("exige apenas a conexão de banco", () => {
    expect(readOutboxConfiguration({})).toEqual({
      configured: false,
      missing: ["DATABASE_ADMIN_URL"],
    });
    expect(
      readOutboxConfiguration({ DATABASE_ADMIN_URL: "https://db.test" }),
    ).toEqual({
      configured: true,
      configuration: { databaseUrl: "https://db.test" },
    });
  });

  it("valida o bearer do cron sem aceitar variantes", () => {
    const secret = "segredo-do-cron-com-pelo-menos-32-caracteres";
    expect(verifyCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyCronAuthorization(`bearer ${secret}`, secret)).toBe(false);
    expect(verifyCronAuthorization("Bearer segredo-incorreto", secret)).toBe(
      false,
    );
    expect(verifyCronAuthorization(null, secret)).toBe(false);
  });
});
