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
  mapPublishedArticle,
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
  publishedArticles,
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
  coverAlt:
    "  Estudantes reunidos em um laboratório de inovação universitário.  ",
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
      stagingObjectKey: "incoming/capa-editorial/original",
      publicObjectKey: "news/capa-editorial/processed.webp",
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
    expect(created.revision.coverAlt).toBe(
      "Estudantes reunidos em um laboratório de inovação universitário.",
    );
    expect(saved.revision).toMatchObject({
      version: 2,
      title: "Laboratório de inovação confirma nova agenda",
      coverAlt:
        "Estudantes reunidos em um laboratório de inovação universitário.",
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
      stagingObjectKey: "incoming/capa-editorial/original",
      publicObjectKey: "news/capa-editorial/processed.webp",
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
    expect(created.revision.coverAlt).toBe(
      "Estudantes reunidos em um laboratório de inovação universitário.",
    );
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
    const [publicRow] = await database.select().from(publishedArticles);
    expect(
      mapPublishedArticle(publicRow, "https://media.nite.test"),
    ).toMatchObject({
      public: true,
      cover: {
        alt: "Estudantes reunidos em um laboratório de inovação universitário.",
      },
    });
  });

  it("bloqueia publicação quando uma imagem inline aninhada ainda não está pronta", async () => {
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
    const inlineMediaId = "30000000-0000-4000-8000-000000000101";
    await database.insert(mediaAssets).values([
      {
        id: firstDraft.coverMediaId,
        stagingObjectKey: "incoming/capa-editorial/original",
        publicObjectKey: "news/capa-editorial/processed.webp",
        mimeType: "image/webp",
        byteSize: 4096,
        width: 1200,
        height: 675,
        checksumSha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        status: "ready",
      },
      {
        id: inlineMediaId,
        stagingObjectKey: "incoming/inline-pendente/original",
        mimeType: "image/png",
        byteSize: 4096,
        status: "pending",
      },
    ]);
    const created = await createArticleDraft(database, {
      actor: publisher,
      input: {
        ...firstDraft,
        body: {
          schemaVersion: 1,
          type: "doc",
          content: [
            {
              type: "blockquote",
              content: [
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "image",
                          attrs: {
                            mediaId: inlineMediaId,
                            alt: "Estudantes participando de uma oficina no laboratório.",
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });

    await expect(
      publishArticle(database, {
        actor: publisher,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
      }),
    ).rejects.toThrow(/imagens inline.*processadas/i);
  });

  it.each(["            ", "curta"])(
    "rejeita capa inválida ao salvar: %s",
    async (coverAlt) => {
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
        stagingObjectKey: "incoming/capa-editorial/original",
        publicObjectKey: "news/capa-editorial/processed.webp",
        mimeType: "image/webp",
        byteSize: 4096,
        width: 1200,
        height: 675,
        checksumSha256:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        status: "ready",
      });

      await expect(
        createArticleDraft(database, {
          actor: publisher,
          input: { ...firstDraft, coverAlt },
        }),
      ).rejects.toThrow();
    },
  );

  it("rejeita publicação de revisão persistida com alt de capa em branco", async () => {
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
      stagingObjectKey: "incoming/capa-editorial/original",
      publicObjectKey: "news/capa-editorial/processed.webp",
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
    const [invalidRevision] = await database
      .insert(articleRevisions)
      .values({
        articleId: created.article.id,
        version: 2,
        contentSchemaVersion: 1,
        title: firstDraft.title,
        summary: firstDraft.summary,
        category: firstDraft.category,
        readTimeMinutes: 1,
        byline: firstDraft.byline,
        featured: false,
        coverMediaId: firstDraft.coverMediaId,
        coverAlt: "   ",
        body: firstDraft.body,
        createdByMembershipId: publisher.id,
      })
      .returning();
    await database
      .update(articles)
      .set({ currentRevisionId: invalidRevision.id })
      .where(eq(articles.id, created.article.id));

    await expect(
      publishArticle(database, {
        actor: publisher,
        articleId: created.article.id,
        expectedRevisionId: invalidRevision.id,
      }),
    ).rejects.toThrow();
  });
});
