import { describe, expect, it } from "vitest";

import {
  UnsafePostgresTestDatabaseError,
  resolvePostgresTestDatabaseUrl,
} from "./postgres-test-database";

describe("guard de reset do PostgreSQL de teste", () => {
  it.each([
    "postgres://postgres:secret@localhost:5432/cms_editorial_test",
    "postgresql://postgres:secret@127.0.0.1:55432/cms_editorial_test",
  ])(
    "autoriza host local e banco _test com opt-in explícito",
    (databaseUrl) => {
      expect(
        resolvePostgresTestDatabaseUrl({
          databaseUrl,
          allowDatabaseReset: "1",
        }),
      ).toBe(databaseUrl);
    },
  );

  it("retorna uma URL canônica construída a partir dos componentes validados", () => {
    expect(
      resolvePostgresTestDatabaseUrl({
        databaseUrl:
          "  postgres://postgres:secret@localhost:5432/cms%5Feditorial%5Ftest  ",
        allowDatabaseReset: "1",
      }),
    ).toBe("postgres://postgres:secret@localhost:5432/cms_editorial_test");
  });

  it("mantém a integração desabilitada quando nenhuma URL foi configurada", () => {
    expect(
      resolvePostgresTestDatabaseUrl({
        databaseUrl: undefined,
        allowDatabaseReset: undefined,
      }),
    ).toBeUndefined();
  });

  it.each([undefined, "", "0", "true"])(
    "rejeita URL configurada sem o opt-in exato (valor: %s)",
    (allowDatabaseReset) => {
      expect(() =>
        resolvePostgresTestDatabaseUrl({
          databaseUrl:
            "postgres://postgres:secret@127.0.0.1:55432/cms_editorial_test",
          allowDatabaseReset,
        }),
      ).toThrow(UnsafePostgresTestDatabaseError);
    },
  );

  it.each([
    "postgres://postgres:secret@database.internal/cms_editorial_test",
    "postgres://postgres:secret@192.168.1.10/cms_editorial_test",
    "postgres://postgres:secret@[::1]/cms_editorial_test",
    "postgres://postgres:secret@local%68ost/cms_editorial_test",
    "postgres://postgres:secret@%2Fvar%2Frun%2Fpostgresql/cms_editorial_test",
  ])("rejeita host fora da allowlist estrita: %s", (databaseUrl) => {
    expect(() =>
      resolvePostgresTestDatabaseUrl({
        databaseUrl,
        allowDatabaseReset: "1",
      }),
    ).toThrow(UnsafePostgresTestDatabaseError);
  });

  it.each([
    "postgres://postgres:secret@localhost/postgres",
    "postgres://postgres:secret@localhost/cms_editorial",
    "postgres://postgres:secret@localhost/cms_editorial_test/extra",
    "postgres://postgres:secret@localhost/%2Fcms_editorial_test",
    "postgres://postgres:secret@localhost/cms_editorial_test%2Fextra",
  ])("rejeita database sem sufixo _test: %s", (databaseUrl) => {
    expect(() =>
      resolvePostgresTestDatabaseUrl({
        databaseUrl,
        allowDatabaseReset: "1",
      }),
    ).toThrow(UnsafePostgresTestDatabaseError);
  });

  it.each([
    "postgres://postgres:secret@localhost/cms_editorial_test?host=database.internal",
    "postgres://postgres:secret@localhost/cms_editorial_test?host=%2Fvar%2Frun%2Fpostgresql",
    "postgres://postgres:secret@localhost/cms_editorial_test?sslmode=require",
    "postgres://postgres:secret@localhost/cms_editorial_test?application_name=membership-test",
    "postgres://postgres:secret@localhost/cms_editorial_test#host=database.internal",
    "postgres://postgres:secret@localhost/cms_editorial_test?",
    "postgres://postgres:secret@localhost/cms_editorial_test#",
  ])("rejeita query, socket ou fragmento adicional: %s", (databaseUrl) => {
    expect(() =>
      resolvePostgresTestDatabaseUrl({
        databaseUrl,
        allowDatabaseReset: "1",
      }),
    ).toThrow(UnsafePostgresTestDatabaseError);
  });

  it.each([
    "not-a-url",
    "https://localhost/cms_editorial_test",
    "postgres://localhost/%E0%A4%A",
  ])("rejeita URL PostgreSQL inválida: %s", (databaseUrl) => {
    expect(() =>
      resolvePostgresTestDatabaseUrl({
        databaseUrl,
        allowDatabaseReset: "1",
      }),
    ).toThrow(UnsafePostgresTestDatabaseError);
  });
});
