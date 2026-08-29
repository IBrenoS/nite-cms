import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  EditorialConflictError,
  EditorialPublicationError,
  createArticleDraft,
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
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);

const firstDraft = {
  title: "Laboratório de inovação abre nova agenda",
  summary:
    "A equipe do NITE apresenta uma agenda editorial validada para atividades acadêmicas e projetos aplicados.",
  category: "inovacao" as const,
  byline: "Redação NITE",
  coverMediaId: "30000000-0000-4000-8000-000000000100",
  coverAlt: "Estudantes reunidos em um laboratório de inovação universitário.",
  featured: false,
  body: {
    schemaVersion: 1 as const,
    type: "doc" as const,
    content: [
      {
        type: "paragraph" as const,
        content: [
          {
            type: "text" as const,
            text: "A programação reúne atividades acadêmicas e projetos aplicados desenvolvidos pela comunidade universitária.",
          },
        ],
      },
    ],
  },
};

describe("comandos editoriais", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("cria revisoes imutaveis e rejeita salvamento concorrente obsoleto", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-oid",
        displayName: "Publisher NITE",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: firstDraft.coverMediaId,
      objectKey: "news/capa-editorial.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "ready",
    });

    const created = await createArticleDraft(database, {
      actor: publisher,
      input: firstDraft,
    });
    const saved = await saveArticleRevision(database, {
      actor: publisher,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
      input: {
        ...firstDraft,
        slug: "",
        title: "Laboratório de inovação confirma nova agenda",
      },
    });

    expect(created.revision.version).toBe(1);
    expect(created.article.slug).toBe(
      "laboratorio-de-inovacao-abre-nova-agenda",
    );
    expect(created.revision.readTimeMinutes).toBe(1);
    expect(saved.revision).toMatchObject({
      version: 2,
      title: "Laboratório de inovação confirma nova agenda",
    });
    expect(saved.article.slug).toBe(
      "laboratorio-de-inovacao-confirma-nova-agenda",
    );
    await expect(
      saveArticleRevision(database, {
        actor: publisher,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
        input: {
          ...firstDraft,
          title: "Título baseado em uma revisão já substituída",
        },
      }),
    ).rejects.toBeInstanceOf(EditorialConflictError);

    await expect(
      database
        .select({ version: articleRevisions.version })
        .from(articleRevisions)
        .where(eq(articleRevisions.articleId, created.article.id)),
    ).resolves.toEqual([{ version: 1 }, { version: 2 }]);
  });

  it("publica e registra auditoria e outbox para publisher", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-oid",
        displayName: "Publisher NITE",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: firstDraft.coverMediaId,
      objectKey: "news/capa-editorial.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "ready",
    });
    const created = await createArticleDraft(database, {
      actor: publisher,
      input: firstDraft,
    });

    const published = await publishArticle(database, {
      actor: publisher,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
    });

    expect(published).toMatchObject({
      status: "published",
      publishedRevisionId: created.revision.id,
    });
    await expect(database.select().from(auditEvents)).resolves.toHaveLength(2);
    await expect(database.select().from(outboxEvents)).resolves.toMatchObject([
      {
        topic: "news.article.published",
        aggregateId: created.article.id,
        status: "pending",
      },
    ]);
    await expect(
      database
        .select({ status: articles.status })
        .from(articles)
        .where(eq(articles.id, created.article.id)),
    ).resolves.toEqual([{ status: "published" }]);

    await expect(
      saveArticleRevision(database, {
        actor: publisher,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
        input: { ...firstDraft, slug: "slug-publico-alterado" },
      }),
    ).rejects.toBeInstanceOf(EditorialPublicationError);

    const savedAfterPublication = await saveArticleRevision(database, {
      actor: publisher,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
      input: {
        ...firstDraft,
        featured: true,
        title: "Laboratório de inovação prepara uma nova chamada",
      },
    });
    expect(savedAfterPublication.article.slug).toBe(created.article.slug);
    await expect(
      client.query<{ featured: boolean; title: string }>(
        "select featured, title from published_articles where article_id = $1",
        [created.article.id],
      ),
    ).resolves.toMatchObject({
      rows: [
        {
          featured: false,
          title: "Laboratório de inovação abre nova agenda",
        },
      ],
    });
  });
});
