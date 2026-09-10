import "server-only";

import {
  deleteExpiredEditorialPreviewSnapshots,
  purgeDeletingMediaAsset,
  processOutboxEvents,
  scheduleOrphanMediaPurges,
  type OutboxDispatcher,
} from "@nite/editorial";
import { getDatabase } from "@nite/cms-db/database";
import { z } from "zod";
import {
  createWebRevalidationDispatcher,
  readOutboxConfiguration,
} from "./outbox-protocol";
import { getMediaObjectStore } from "./media-storage";

export function createCmsOutboxDispatcher(input: {
  database: ReturnType<typeof getDatabase>;
  webDispatcher: OutboxDispatcher;
}): OutboxDispatcher {
  return {
    async dispatch(message) {
      if (message.topic === "media.asset.purge") {
        await purgeDeletingMediaAsset(input.database, getMediaObjectStore(), {
          mediaId: z.uuid().parse(message.aggregateId),
        });
        return;
      }
      await input.webDispatcher.dispatch(message);
    },
  };
}

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
  await deleteExpiredEditorialPreviewSnapshots(database);
  await scheduleOrphanMediaPurges(database);
  const webDispatcher = createWebRevalidationDispatcher({
    endpointUrl: result.configuration.revalidationUrl,
    secret: result.configuration.revalidationSecret,
  });
  const dispatcher = createCmsOutboxDispatcher({ database, webDispatcher });
  return processOutboxEvents(database, dispatcher, { batchSize: 25 });
}
