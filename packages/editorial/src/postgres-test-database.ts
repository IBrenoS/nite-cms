export class UnsafePostgresTestDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafePostgresTestDatabaseError";
  }
}

export function resolvePostgresTestDatabaseUrl(configuration: {
  databaseUrl: string | undefined;
  allowDatabaseReset: string | undefined;
}): string | undefined {
  const databaseUrl = configuration.databaseUrl?.trim();
  if (!databaseUrl) return undefined;

  if (configuration.allowDatabaseReset !== "1") {
    throw new UnsafePostgresTestDatabaseError(
      "O reset exige CMS_TEST_ALLOW_DATABASE_RESET=1.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new UnsafePostgresTestDatabaseError(
      "CMS_TEST_DATABASE_URL não é uma URL válida.",
    );
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new UnsafePostgresTestDatabaseError(
      "CMS_TEST_DATABASE_URL deve usar o protocolo PostgreSQL.",
    );
  }

  if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
    throw new UnsafePostgresTestDatabaseError(
      "O reset só é permitido em localhost ou 127.0.0.1.",
    );
  }

  if (parsedUrl.href.includes("?") || parsedUrl.href.includes("#")) {
    throw new UnsafePostgresTestDatabaseError(
      "CMS_TEST_DATABASE_URL não pode conter query ou fragmento.",
    );
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
  } catch {
    throw new UnsafePostgresTestDatabaseError(
      "CMS_TEST_DATABASE_URL contém um database inválido.",
    );
  }

  if (!databaseName.endsWith("_test") || databaseName.includes("/")) {
    throw new UnsafePostgresTestDatabaseError(
      "O reset só é permitido em database com sufixo _test.",
    );
  }

  const canonicalUrl = new URL(`${parsedUrl.protocol}//${parsedUrl.hostname}`);
  canonicalUrl.username = parsedUrl.username;
  canonicalUrl.password = parsedUrl.password;
  canonicalUrl.port = parsedUrl.port;
  canonicalUrl.pathname = `/${databaseName}`;

  return canonicalUrl.toString();
}
