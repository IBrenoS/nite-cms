import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  CmsAuthorizationError,
  EditorialConflictError,
  createArticleDraft,
  createEditorialPreviewSnapshot,
  getEditorialPreviewSnapshot,
} from "@nite/editorial";
import {
  articleRevisions,
  cmsMemberships,
  mediaAssets,
  previewMediaReferences,
  previewSnapshots,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);
const coverMediaId = "30000000-0000-4000-8000-000000000201";
const input = {
  slug: "preview-ao-vivo",
  title: "Título atual ainda não salvo como revisão",
  summary:
    "Resumo atual com conteúdo suficiente para o contrato editorial do preview privado.",
  category: "inovacao" as const,
  byline: "Redação NITE",
  coverMediaId,
  coverAlt: "Equipe reunida para revisar uma matéria no laboratório.",
  featured: false,
  body: {
    schemaVersion: 1 as const,
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [{ type: "text" as const, text: "Conteúdo ainda não salvo." }],
      },
    ],
  },
};

describe("snapshot editorial temporário", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => client.close());

  it("mantém as alterações atuais fora do histórico de revisões e expira em dez minutos", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-preview",
        objectId: "publisher-preview",
        displayName: "Publisher Preview",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: coverMediaId,
      stagingObjectKey: "incoming/preview/original",
      publicObjectKey: "news/preview.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
      status: "ready",
    });
    const created = await createArticleDraft(database, {
      actor: publisher,
      input,
    });
    const now = new Date("2026-09-08T15:00:00.000Z");

    const snapshot = await createEditorialPreviewSnapshot(database, {
      actor: publisher,
      articleId: created.article.id,
      baseRevisionId: created.revision.id,
      input: { ...input, title: "Título modificado apenas no preview" },
      now,
    });

    expect(snapshot.expiresAt).toEqual(
      new Date(now.getTime() + 10 * 60 * 1000),
    );
    await expect(
      database
        .select({ mediaId: previewMediaReferences.mediaId })
        .from(previewMediaReferences)
        .where(eq(previewMediaReferences.snapshotId, snapshot.id)),
    ).resolves.toEqual([{ mediaId: coverMediaId }]);
    expect(
      await getEditorialPreviewSnapshot(
        database,
        { articleId: created.article.id, snapshotId: snapshot.id },
        now,
      ),
    ).toMatchObject({
      snapshot: { id: snapshot.id, baseRevisionId: created.revision.id },
      input: { title: "Título modificado apenas no preview" },
    });
    await expect(
      database
        .select({ value: count() })
        .from(articleRevisions)
        .where(eq(articleRevisions.articleId, created.article.id)),
    ).resolves.toEqual([{ value: 1 }]);
    await expect(
      getEditorialPreviewSnapshot(
        database,
        { articleId: created.article.id, snapshotId: snapshot.id },
        new Date(now.getTime() + 10 * 60 * 1000),
      ),
    ).resolves.toBeUndefined();
    await expect(
      database
        .select({ value: count() })
        .from(previewSnapshots)
        .where(eq(previewSnapshots.id, snapshot.id)),
    ).resolves.toEqual([{ value: 0 }]);

    const activeSnapshot = await createEditorialPreviewSnapshot(database, {
      actor: publisher,
      articleId: created.article.id,
      baseRevisionId: created.revision.id,
      input,
      now: new Date(now.getTime() + 11 * 60 * 1000),
    });
    await database
      .update(cmsMemberships)
      .set({ active: false })
      .where(eq(cmsMemberships.id, publisher.id));
    await expect(
      getEditorialPreviewSnapshot(
        database,
        { articleId: created.article.id, snapshotId: activeSnapshot.id },
        new Date(now.getTime() + 11 * 60 * 1000),
      ),
    ).resolves.toBeUndefined();
    await expect(
      createEditorialPreviewSnapshot(database, {
        actor: publisher,
        articleId: created.article.id,
        baseRevisionId: created.revision.id,
        input,
        now: new Date(now.getTime() + 11 * 60 * 1000),
      }),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);
  });

  it("rejeita snapshot baseado em revisão que já deixou de ser atual", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-conflict",
        objectId: "publisher-conflict",
        displayName: "Publisher Conflict",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: coverMediaId,
      stagingObjectKey: "incoming/conflict/original",
      publicObjectKey: "news/conflict.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef",
      status: "ready",
    });
    const created = await createArticleDraft(database, {
      actor: publisher,
      input,
    });

    await expect(
      createEditorialPreviewSnapshot(database, {
        actor: publisher,
        articleId: created.article.id,
        baseRevisionId: "20000000-0000-4000-8000-000000000999",
        input,
      }),
    ).rejects.toBeInstanceOf(EditorialConflictError);
    await expect(database.select().from(previewSnapshots)).resolves.toEqual([]);
  });
});
