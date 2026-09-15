import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  EditorialConflictError,
  EditorialPublicationError,
  EditorialSlugConflictError,
  createArticleDraft,
  editorialDraftInputSchema,
  editorialPublishableInputSchema,
  mapPublishedArticle,
  publishArticle,
  saveArticleRevision,
  submitEditorialRevision,
  validateEditorialInputForPublication,
  validateEditorialRevisionForPreview,
} from "@nite/editorial";
import {
  articleMediaReferences,
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
  coverCaption: "  Oficina no laboratório de inovação.  ",
  coverCredit: "  Foto: Comunicação NITE  ",
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

  it("registra uma referencia permanente para cada midia usada pela materia", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-referencias-oid",
        displayName: "Publisher Referencias",
        role: "publisher",
      })
      .returning();
    const inlineMediaId = "30000000-0000-4000-8000-000000000101";
    await database.insert(mediaAssets).values([
      {
        id: firstDraft.coverMediaId,
        stagingObjectKey: "incoming/capa-referencias/original",
        publicObjectKey: "news/capa-referencias/processed.webp",
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
        stagingObjectKey: "incoming/inline-referencias/original",
        publicObjectKey: "news/inline-referencias/processed.webp",
        mimeType: "image/webp",
        byteSize: 2048,
        width: 800,
        height: 600,
        checksumSha256:
          "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        status: "ready",
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
              type: "image",
              attrs: {
                mediaId: inlineMediaId,
                alt: "Atividade editorial no laboratório.",
              },
            },
          ],
        },
      },
    });

    await expect(
      database
        .select({ mediaId: articleMediaReferences.mediaId })
        .from(articleMediaReferences)
        .where(eq(articleMediaReferences.articleId, created.article.id)),
    ).resolves.toEqual(
      expect.arrayContaining([
        { mediaId: firstDraft.coverMediaId },
        { mediaId: inlineMediaId },
      ]),
    );
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
      slugManuallyEdited: false,
      input: {
        ...firstDraft,
        slug: created.article.slug,
        title: "Laboratório de inovação confirma nova agenda",
      },
    });

    expect(created.revision.version).toBe(1);
    expect(created.article.slug).toBe(
      "laboratorio-de-inovacao-abre-nova-agenda",
    );
    expect(created.article.slugManuallyEdited).toBe(false);
    expect(created.revision.readTimeMinutes).toBe(1);
    expect(created.revision.coverAlt).toBe(
      "Estudantes reunidos em um laboratório de inovação universitário.",
    );
    expect(created.revision.coverCaption).toBe(
      "Oficina no laboratório de inovação.",
    );
    expect(created.revision.coverCredit).toBe("Foto: Comunicação NITE");
    expect(saved.revision).toMatchObject({
      version: 2,
      title: "Laboratório de inovação confirma nova agenda",
      coverAlt:
        "Estudantes reunidos em um laboratório de inovação universitário.",
    });
    expect(saved.article.slug).toBe(
      "laboratorio-de-inovacao-confirma-nova-agenda",
    );
    expect(saved.article.slugManuallyEdited).toBe(false);
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
        .select({
          currentRevisionId: articles.currentRevisionId,
          slug: articles.slug,
          slugManuallyEdited: articles.slugManuallyEdited,
        })
        .from(articles)
        .where(eq(articles.id, created.article.id)),
    ).resolves.toEqual([
      {
        currentRevisionId: saved.revision.id,
        slug: "laboratorio-de-inovacao-confirma-nova-agenda",
        slugManuallyEdited: false,
      },
    ]);

    const savedAgain = await saveArticleRevision(database, {
      actor: publisher,
      articleId: created.article.id,
      expectedRevisionId: saved.revision.id,
      slugManuallyEdited: false,
      input: {
        ...firstDraft,
        slug: saved.article.slug,
        title: "Laboratório de inovação divulga a programação final",
      },
    });
    expect(savedAgain.article).toMatchObject({
      slug: "laboratorio-de-inovacao-divulga-a-programacao-final",
      slugManuallyEdited: false,
    });

    await expect(
      database
        .select({ version: articleRevisions.version })
        .from(articleRevisions)
        .where(eq(articleRevisions.articleId, created.article.id)),
    ).resolves.toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
  });

  it("valida uma revisão histórica para preview sem exigir que seja a atual", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-preview-historico",
        objectId: "publisher-preview-historico-oid",
        displayName: "Publisher Preview Histórico",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: firstDraft.coverMediaId,
      stagingObjectKey: "incoming/capa-preview-historico/original",
      publicObjectKey: "news/capa-preview-historico/processed.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "dededededededededededededededededededededededededededededededede",
      status: "ready",
    });
    const created = await createArticleDraft(database, {
      actor: publisher,
      input: firstDraft,
    });
    await saveArticleRevision(database, {
      actor: publisher,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
      input: {
        ...firstDraft,
        slug: created.article.slug,
        title: "Versão atual da matéria",
      },
    });

    const preview = await validateEditorialRevisionForPreview(database, {
      actor: publisher,
      articleId: created.article.id,
      revisionId: created.revision.id,
    });

    expect(preview.title).toBe(firstDraft.title);
  });

  it("valida um snapshot publicavel sem criar revisao", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-preview",
        objectId: "publisher-preview-oid",
        displayName: "Publisher Preview",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: firstDraft.coverMediaId,
      stagingObjectKey: "incoming/capa-preview/original",
      publicObjectKey: "news/capa-preview/processed.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "abababababababababababababababababababababababababababababababab",
      status: "ready",
    });
    const created = await createArticleDraft(database, {
      actor: publisher,
      input: firstDraft,
    });

    const validated = await validateEditorialInputForPublication(database, {
      actor: publisher,
      input: {
        ...firstDraft,
        slug: "titulo-ainda-nao-salvo",
        title: "Título ainda não salvo no histórico",
      },
    });

    expect(validated.title).toBe("Título ainda não salvo no histórico");
    await expect(
      database
        .select({ version: articleRevisions.version })
        .from(articleRevisions)
        .where(eq(articleRevisions.articleId, created.article.id)),
    ).resolves.toEqual([{ version: 1 }]);
  });

  it("preserva o modo manual mesmo quando o cliente tenta voltar ao automatico", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-manual-oid",
        displayName: "Publisher Manual",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: firstDraft.coverMediaId,
      stagingObjectKey: "incoming/capa-manual/original",
      publicObjectKey: "news/capa-manual/processed.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      status: "ready",
    });

    const created = await createArticleDraft(database, {
      actor: publisher,
      slugManuallyEdited: true,
      input: { ...firstDraft, slug: "agenda-personalizada" },
    });
    const saved = await saveArticleRevision(database, {
      actor: publisher,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
      slugManuallyEdited: false,
      input: {
        ...firstDraft,
        slug: "agenda-personalizada",
        title: "Laboratório de inovação confirma outra programação",
      },
    });

    expect(created.article).toMatchObject({
      slug: "agenda-personalizada",
      slugManuallyEdited: true,
    });
    expect(saved.article).toMatchObject({
      slug: "agenda-personalizada",
      slugManuallyEdited: true,
    });
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

  it.each(["", "curta"])(
    "aceita texto alternativo de capa incompleto ao salvar rascunho: %s",
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
      ).resolves.toMatchObject({ revision: { coverAlt } });
    },
  );

  it("aceita rascunho parcial e reserva as exigências editoriais para publicação", () => {
    const partialDraft = {
      title: "Rascunho",
      summary: "",
      category: "" as const,
      byline: "",
      coverMediaId: null,
      coverAlt: "",
      featured: false,
      body: {
        schemaVersion: 1 as const,
        type: "doc" as const,
        content: [{ type: "paragraph" as const, content: [] }],
      },
      seo: { title: "SEO parcial", description: "" },
    };

    expect(editorialDraftInputSchema.parse(partialDraft)).toEqual(partialDraft);
    const published = editorialPublishableInputSchema.safeParse(partialDraft);
    expect(published.success).toBe(false);
    if (!published.success) {
      expect(
        published.error.issues.map((issue) => issue.path.join(".")),
      ).toEqual(
        expect.arrayContaining([
          "slug",
          "title",
          "summary",
          "category",
          "byline",
          "coverMediaId",
          "coverAlt",
          "body.content",
          "seo.title",
          "seo.description",
        ]),
      );
    }
  });

  it("persiste um rascunho parcial sem capa, categoria ou corpo significativo", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-partial-oid",
        displayName: "Publisher Parcial",
        role: "publisher",
      })
      .returning();

    const created = await createArticleDraft(database, {
      actor: publisher,
      input: {
        title: "Rascunho parcial",
        summary: "",
        category: "",
        byline: "",
        coverMediaId: null,
        coverAlt: "",
        featured: false,
        body: {
          schemaVersion: 1,
          type: "doc",
          content: [{ type: "paragraph", content: [] }],
        },
      },
    });

    expect(created.article.slug).toBe("rascunho-parcial");
    expect(created.revision).toMatchObject({
      summary: "",
      category: "",
      byline: "",
      coverMediaId: null,
      coverAlt: "",
    });
  });

  it("reverte criação e revisão quando a publicação falha após a persistência", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-atomic-oid",
        displayName: "Publisher Atômico",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: firstDraft.coverMediaId,
      stagingObjectKey: "incoming/capa-atomica/original",
      mimeType: "image/png",
      byteSize: 4096,
      status: "pending",
    });

    await expect(
      submitEditorialRevision(database, {
        actor: publisher,
        intent: "publish",
        target: { kind: "new" },
        slugManuallyEdited: false,
        input: firstDraft,
      }),
    ).rejects.toThrow(/capa.*processada/i);

    await expect(database.select().from(articles)).resolves.toHaveLength(0);
    await expect(
      database.select().from(articleRevisions),
    ).resolves.toHaveLength(0);
    await expect(database.select().from(auditEvents)).resolves.toHaveLength(0);
    await expect(database.select().from(outboxEvents)).resolves.toHaveLength(0);
  });

  it("salva e publica uma matéria nova na mesma operação", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-submit-oid",
        displayName: "Publisher Submit",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: firstDraft.coverMediaId,
      stagingObjectKey: "incoming/capa-submit/original",
      publicObjectKey: "news/capa-submit/processed.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      status: "ready",
    });

    const result = await submitEditorialRevision(database, {
      actor: publisher,
      intent: "publish",
      target: { kind: "new" },
      input: firstDraft,
    });

    expect(result.article).toMatchObject({
      status: "published",
      publishedRevisionId: result.revision.id,
    });
    await expect(database.select().from(auditEvents)).resolves.toHaveLength(2);
    await expect(database.select().from(outboxEvents)).resolves.toHaveLength(1);
  });

  it("traduz colisão de slug para um erro editorial tipado", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-slug-oid",
        displayName: "Publisher Slug",
        role: "publisher",
      })
      .returning();
    const input = {
      title: "Rascunho com slug manual",
      summary: "",
      category: "" as const,
      byline: "",
      featured: false,
      coverMediaId: null,
      coverAlt: "",
      body: {
        schemaVersion: 1 as const,
        type: "doc" as const,
        content: [{ type: "paragraph" as const, content: [] }],
      },
      slug: "slug-repetido",
    };

    await createArticleDraft(database, {
      actor: publisher,
      input,
      slugManuallyEdited: true,
    });
    await expect(
      createArticleDraft(database, {
        actor: publisher,
        input,
        slugManuallyEdited: true,
      }),
    ).rejects.toBeInstanceOf(EditorialSlugConflictError);
  });

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
