import "server-only";

import { processOutboxEvents } from "@nite/editorial";
import { getDatabase } from "@nite/cms-db/database";
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

  const database = getDatabase({
    databaseUrl: result.configuration.databaseUrl,
  });
  const dispatcher = createWebRevalidationDispatcher({
    endpointUrl: result.configuration.revalidationUrl,
    secret: result.configuration.revalidationSecret,
  });
  return processOutboxEvents(database, dispatcher, { batchSize: 25 });
}
