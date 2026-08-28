import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  CmsAuthorizationError,
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
  slug: "laboratorio-de-inovacao",
  title: "Laboratório de inovação abre nova agenda",
  summary:
    "A equipe do NITE apresenta uma agenda editorial validada para atividades acadêmicas e projetos aplicados.",
  category: "inovacao" as const,
  readTimeMinutes: 4,
  byline: "Redação NITE",
  coverMediaId: "30000000-0000-4000-8000-000000000100",
  coverAlt: "Estudantes reunidos em um laboratório de inovação universitário.",
  featured: false,
  body: [
    {
      type: "paragraph" as const,
      text: "A programação reúne atividades acadêmicas e projetos aplicados desenvolvidos pela comunidade universitária.",
    },
  ],
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
    const [author] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "author-oid",
        displayName: "Autora NITE",
        role: "author",
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
      actor: author,
      input: firstDraft,
    });
    const saved = await saveArticleRevision(database, {
      actor: author,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
      input: {
        ...firstDraft,
        title: "Laboratório de inovação confirma nova agenda",
      },
    });

    expect(created.revision.version).toBe(1);
    expect(saved.revision).toMatchObject({
      version: 2,
      title: "Laboratório de inovação confirma nova agenda",
    });
    await expect(
      saveArticleRevision(database, {
        actor: author,
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

  it("impede autor de publicar e registra auditoria e outbox para editor", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [author, editor] = await database
      .insert(cmsMemberships)
      .values([
        {
          tenantId: "tenant-nite",
          objectId: "author-oid",
          displayName: "Autora NITE",
          role: "author" as const,
        },
        {
          tenantId: "tenant-nite",
          objectId: "editor-oid",
          displayName: "Editora NITE",
          role: "editor" as const,
        },
      ])
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
      actor: author,
      input: firstDraft,
    });

    await expect(
      publishArticle(database, {
        actor: author,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
      }),
    ).rejects.toBeInstanceOf(CmsAuthorizationError);

    const published = await publishArticle(database, {
      actor: editor,
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
        actor: editor,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
        input: { ...firstDraft, slug: "slug-publico-alterado" },
      }),
    ).rejects.toBeInstanceOf(EditorialPublicationError);

    await saveArticleRevision(database, {
      actor: editor,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
      input: {
        ...firstDraft,
        featured: true,
        title: "Laboratório de inovação prepara uma nova chamada",
      },
    });
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
