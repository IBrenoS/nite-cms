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
import { readOutboxConfiguration } from "./outbox-protocol";
import { readEmailConfiguration } from "./email-config";
import { getMediaObjectStore } from "./media-storage";
import {
  createResendInvitationEmailProvider,
  dispatchMembershipInvitationEmail,
} from "./resend-email";

const stagingPurgePayloadSchema = z.object({
  mediaId: z.uuid(),
  stagingObjectKey: z.string().min(1),
});
const invitationEmailPayloadSchema = z.object({ invitationId: z.uuid() });

export function createCmsOutboxDispatcher(input: {
  database: ReturnType<typeof getDatabase>;
  sendInvitationEmail?: (input: {
    outboxEventId: string;
    invitationId: string;
  }) => Promise<void>;
}): OutboxDispatcher {
  return {
    async dispatch(message) {
      if (message.topic === "media.staging.purge") {
        const payload = stagingPurgePayloadSchema.parse(message.payload);
        if (payload.mediaId !== message.aggregateId) {
          throw new Error("Evento de limpeza de staging inconsistente.");
        }
        await getMediaObjectStore().deleteStagingObject(
          payload.stagingObjectKey,
        );
        return;
      }
      if (message.topic === "media.asset.purge") {
        await purgeDeletingMediaAsset(input.database, getMediaObjectStore(), {
          mediaId: z.uuid().parse(message.aggregateId),
        });
        return;
      }
      if (message.topic === "membership.invitation.email.requested") {
        const payload = invitationEmailPayloadSchema.parse(message.payload);
        if (payload.invitationId !== message.aggregateId) {
          throw new Error("Evento de e-mail de convite inconsistente.");
        }
        if (!input.sendInvitationEmail) {
          throw new Error("Dispatcher de e-mail de convite indisponível.");
        }
        await input.sendInvitationEmail({
          outboxEventId: message.id,
          invitationId: payload.invitationId,
        });
        return;
      }
      if (
        message.topic === "news.article.published" ||
        message.topic === "news.article.unpublished" ||
        message.topic === "news.article.archived"
      ) {
        // Eventos antigos não exigem invalidação: o Portal consulta o CMS por requisição.
        return;
      }
      throw new Error(`Tópico do outbox não suportado: ${message.topic}.`);
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
  const dispatcher = createCmsOutboxDispatcher({
    database,
    async sendInvitationEmail(input) {
      const emailConfiguration = readEmailConfiguration(process.env);
      if (!emailConfiguration.configured) {
        throw new Error("Configuração de e-mail indisponível.");
      }
      const configuration = emailConfiguration.configuration;
      await dispatchMembershipInvitationEmail({
        database,
        ...input,
        provider: createResendInvitationEmailProvider(configuration.apiKey),
        configuration,
      });
    },
  });
  return processOutboxEvents(database, dispatcher, { batchSize: 25 });
}
