import "server-only";

import { processOutboxEvents } from "@nite/content/admin";
import { getCmsDatabase } from "./database";
import {
  createWebRevalidationDispatcher,
  readOutboxConfiguration,
} from "./outbox-protocol";

export async function processCmsOutbox() {
  const result = readOutboxConfiguration(process.env);
  if (!result.configured) {
    throw new Error(
      `Configuração operacional ausente: ${result.missing.join(", ")}.`,
    );
  }

  const database = getCmsDatabase({
    databaseUrl: result.configuration.databaseUrl,
  });
  const dispatcher = createWebRevalidationDispatcher({
    endpointUrl: result.configuration.revalidationUrl,
    secret: result.configuration.revalidationSecret,
  });
  return processOutboxEvents(database, dispatcher, { batchSize: 25 });
}
