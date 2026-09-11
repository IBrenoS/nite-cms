import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  CmsAuthorizationError,
  createArticleDraft,
  createEditorialPreviewSnapshot,
  deleteEditorialArticle,
  getEditorialArticleDeletionImpact,
  EditorialConflictError,
  publishArticle,
  saveArticleRevision,
} from "@nite/editorial";
import {
  articleRevisions,
  articles,
  auditEvents,
  cmsMemberships,
  mediaAssets,
  outboxEvents,
  previewSnapshots,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);
const sharedMediaId = "30000000-0000-4000-8000-000000000301";
const exclusiveMediaId = "30000000-0000-4000-8000-000000000302";
const sharedVideoId = "30000000-0000-4000-8000-000000000303";
const exclusiveCaptionsId = "30000000-0000-4000-8000-000000000304";

function mediaValues(id: string, suffix: string) {
  return {
    id,
    stagingObjectKey: `incoming/${suffix}/original`,
    publicObjectKey: `news/${suffix}/processed.webp`,
    mimeType: "image/webp",
    byteSize: 4096,
    width: 1200,
    height: 675,
    checksumSha256:
      "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    status: "ready" as const,
  };
}

function videoValues(id: string, suffix: string) {
  return {
    id,
    mediaKind: "video" as const,
    stagingObjectKey: `incoming/${suffix}/original`,
    publicObjectKey: `news/${suffix}/video.mp4`,
    mimeType: "video/mp4",
    byteSize: 4096,
    width: 1920,
    height: 1080,
    durationMs: 30_000,
    videoCodec: "avc1.640028",
    hasAudio: true,
    objectEtag: `etag-${suffix}`,
    status: "ready" as const,
  };
}

function captionsValues(id: string, suffix: string) {
  return {
    id,
    mediaKind: "captions" as const,
    stagingObjectKey: `incoming/${suffix}/original`,
    publicObjectKey: `news/${suffix}/captions.vtt`,
    mimeType: "text/vtt",
    byteSize: 512,
    durationMs: 29_000,
    checksumSha256:
      "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    status: "ready" as const,
  };
}

function articleInput(title: string, includeExclusiveMedia = false) {
  return {
    title,
    summary:
      "Resumo editorial suficientemente descritivo para validar a exclusão definitiva da matéria.",
    category: "inovacao" as const,
    byline: "Redação NITE",
    coverMediaId: sharedMediaId,
    coverAlt: "Equipe reunida em atividade no laboratório universitário.",
    featured: false,
    body: {
      schemaVersion: 1 as const,
      type: "doc" as const,
      content: includeExclusiveMedia
        ? [
            {
              type: "image" as const,
              attrs: {
                mediaId: exclusiveMediaId,
                alt: "Detalhe da atividade editorial realizada no laboratório.",
              },
            },
          ]
        : [
            {
              type: "paragraph" as const,
              content: [
                {
                  type: "text" as const,
                  text: "Conteúdo editorial mantido para validar referências compartilhadas.",
                },
              ],
            },
          ],
    },
  };
}

function videoArticleInput(title: string, playbackMode: "autoplay" | "manual") {
  return {
    ...articleInput(title),
    body: {
      schemaVersion: 3 as const,
      type: "doc" as const,
      content: [
        {
          type: "video" as const,
          attrs: {
            mediaId: sharedVideoId,
            ...(playbackMode === "manual"
              ? { captionsMediaId: exclusiveCaptionsId }
              : {}),
            playbackMode,
            layout: "normal" as const,
          },
        },
      ],
    },
  };
}

describe("exclusão editorial definitiva", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => client.close());

  it("remove o agregado e agenda apenas a mídia que ficou órfã", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "admin-delete-oid",
        displayName: "Admin Delete",
        role: "admin",
      })
      .returning();
    await database
      .insert(mediaAssets)
      .values([
        mediaValues(sharedMediaId, "shared"),
        mediaValues(exclusiveMediaId, "exclusive"),
      ]);

    await createArticleDraft(database, {
      actor: admin,
      input: articleInput("Matéria compartilhando a mesma imagem de capa"),
    });
    const target = await createArticleDraft(database, {
      actor: admin,
      input: articleInput(
        "Matéria publicada destinada à exclusão definitiva",
        true,
      ),
    });
    const saved = await saveArticleRevision(database, {
      actor: admin,
      articleId: target.article.id,
      expectedRevisionId: target.revision.id,
      input: {
        ...articleInput(
          "Matéria publicada destinada à exclusão definitiva",
          true,
        ),
        slug: target.article.slug,
      },
    });
    const snapshot = await createEditorialPreviewSnapshot(database, {
      actor: admin,
      articleId: target.article.id,
      baseRevisionId: saved.revision.id,
      input: {
        ...articleInput(
          "Matéria publicada destinada à exclusão definitiva",
          true,
        ),
        slug: saved.article.slug,
      },
    });
    await publishArticle(database, {
      actor: admin,
      articleId: target.article.id,
      expectedRevisionId: saved.revision.id,
    });

    await expect(
      getEditorialArticleDeletionImpact(database, {
        actor: admin,
        articleId: target.article.id,
        expectedRevisionId: saved.revision.id,
      }),
    ).resolves.toMatchObject({
      revisionCount: 2,
      snapshotCount: 1,
      mediaCount: 2,
      exclusiveMediaCount: 1,
      sharedMediaCount: 1,
    });

    await expect(
      deleteEditorialArticle(database, {
        actor: admin,
        articleId: target.article.id,
        expectedRevisionId: saved.revision.id,
      }),
    ).resolves.toEqual({
      articleId: target.article.id,
      deletedRevisionCount: 2,
      deletedSnapshotCount: 1,
      scheduledMediaCount: 1,
    });

    await expect(
      database
        .select()
        .from(articles)
        .where(eq(articles.id, target.article.id)),
    ).resolves.toEqual([]);
    await expect(
      database
        .select()
        .from(articleRevisions)
        .where(eq(articleRevisions.articleId, target.article.id)),
    ).resolves.toEqual([]);
    await expect(
      database
        .select()
        .from(previewSnapshots)
        .where(eq(previewSnapshots.id, snapshot.id)),
    ).resolves.toEqual([]);
    await expect(
      database
        .select({ id: mediaAssets.id, status: mediaAssets.status })
        .from(mediaAssets),
    ).resolves.toEqual(
      expect.arrayContaining([
        { id: sharedMediaId, status: "ready" },
        { id: exclusiveMediaId, status: "deleting" },
      ]),
    );
    await expect(
      database
        .select({ action: auditEvents.action })
        .from(auditEvents)
        .where(eq(auditEvents.aggregateId, target.article.id)),
    ).resolves.toContainEqual({ action: "article.deleted" });
    await expect(
      database
        .select({ topic: outboxEvents.topic })
        .from(outboxEvents)
        .where(eq(outboxEvents.aggregateId, target.article.id)),
    ).resolves.toContainEqual({ topic: "news.article.unpublished" });
    await expect(
      database
        .select({ topic: outboxEvents.topic })
        .from(outboxEvents)
        .where(eq(outboxEvents.aggregateId, exclusiveMediaId)),
    ).resolves.toEqual([{ topic: "media.asset.purge" }]);
  });

  it("preserva MP4 compartilhado e agenda o WebVTT exclusivo ao excluir V3", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "admin-delete-video-oid",
        displayName: "Admin Delete Video",
        role: "admin",
      })
      .returning();
    await database
      .insert(mediaAssets)
      .values([
        mediaValues(sharedMediaId, "video-cover"),
        videoValues(sharedVideoId, "shared-video"),
        captionsValues(exclusiveCaptionsId, "exclusive-captions"),
      ]);

    await createArticleDraft(database, {
      actor: admin,
      input: videoArticleInput(
        "Matéria que mantém o MP4 compartilhado",
        "autoplay",
      ),
    });
    const target = await createArticleDraft(database, {
      actor: admin,
      input: videoArticleInput("Matéria V3 com legenda exclusiva", "manual"),
    });

    await expect(
      deleteEditorialArticle(database, {
        actor: admin,
        articleId: target.article.id,
        expectedRevisionId: target.revision.id,
      }),
    ).resolves.toMatchObject({ scheduledMediaCount: 1 });

    await expect(
      database
        .select({ id: mediaAssets.id, status: mediaAssets.status })
        .from(mediaAssets),
    ).resolves.toEqual(
      expect.arrayContaining([
        { id: sharedMediaId, status: "ready" },
        { id: sharedVideoId, status: "ready" },
        { id: exclusiveCaptionsId, status: "deleting" },
      ]),
    );
    await expect(
      database
        .select({ topic: outboxEvents.topic })
        .from(outboxEvents)
        .where(eq(outboxEvents.aggregateId, exclusiveCaptionsId)),
    ).resolves.toEqual([{ topic: "media.asset.purge" }]);
  });

  it("rejeita publisher e revisão obsoleta sem remover a matéria", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin, publisher] = await database
      .insert(cmsMemberships)
      .values([
        {
          tenantId: "tenant-nite",
          objectId: "admin-delete-conflict",
          displayName: "Admin Delete",
          role: "admin",
        },
        {
          tenantId: "tenant-nite",
          objectId: "publisher-delete-conflict",
          displayName: "Publisher Delete",
          role: "publisher",
        },
      ])
      .returning();
    await database
      .insert(mediaAssets)
      .values(mediaValues(sharedMediaId, "authorization"));
    const target = await createArticleDraft(database, {
      actor: admin,
      input: articleInput("Matéria protegida contra exclusão indevida"),
    });

    await expect(
      deleteEditorialArticle(database, {
        actor: publisher,
        articleId: target.article.id,
        expectedRevisionId: target.revision.id,
      }),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
    await expect(
      deleteEditorialArticle(database, {
        actor: admin,
        articleId: target.article.id,
        expectedRevisionId: "20000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toBeInstanceOf(EditorialConflictError);
    await expect(
      database
        .select()
        .from(articles)
        .where(eq(articles.id, target.article.id)),
    ).resolves.toHaveLength(1);
  });

  it("reverte toda a exclusão quando o outbox não pode ser gravado", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [admin] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "admin-delete-rollback",
        displayName: "Admin Rollback",
        role: "admin",
      })
      .returning();
    await database
      .insert(mediaAssets)
      .values(mediaValues(sharedMediaId, "rollback"));
    const target = await createArticleDraft(database, {
      actor: admin,
      input: articleInput("Matéria preservada quando o outbox falhar"),
    });
    await client.exec(`
      CREATE FUNCTION reject_media_purge_outbox() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.topic = 'media.asset.purge' THEN
          RAISE EXCEPTION 'outbox indisponivel';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER reject_media_purge_outbox_trigger
      BEFORE INSERT ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION reject_media_purge_outbox();
    `);

    await expect(
      deleteEditorialArticle(database, {
        actor: admin,
        articleId: target.article.id,
        expectedRevisionId: target.revision.id,
      }),
    ).rejects.toThrow();
    await expect(
      database
        .select()
        .from(articles)
        .where(eq(articles.id, target.article.id)),
    ).resolves.toHaveLength(1);
    await expect(
      database
        .select({ status: mediaAssets.status })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, sharedMediaId)),
    ).resolves.toEqual([{ status: "ready" }]);
    await expect(
      database
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "article.deleted")),
    ).resolves.toEqual([]);
  });
});
