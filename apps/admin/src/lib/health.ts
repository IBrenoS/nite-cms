import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "@nite/cms-db/database";
import { readAdminConfiguration } from "./auth-config";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;
type DatabaseProbe = (databaseUrl: string) => Promise<void>;

async function probeConfiguredDatabase(databaseUrl: string) {
  const database = getDatabase({ databaseUrl });
  await database.execute(sql`select 1`);
}

export async function checkAdminDatabase(
  options: {
    environment?: EnvironmentSource;
    probeDatabase?: DatabaseProbe;
  } = {},
) {
  const configuration = readAdminConfiguration(
    options.environment ?? process.env,
  );
  if (!configuration.configured) {
    throw new Error("Configuração administrativa indisponível.");
  }

  await (options.probeDatabase ?? probeConfiguredDatabase)(
    configuration.configuration.databaseUrl,
  );
}
