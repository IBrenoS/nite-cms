import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import * as editorial from "@nite/editorial";
import {
  EditorialConflictError,
  EditorialPublicationError,
  createArticleDraft,
  publishArticle,
  saveArticleRevision,
} from "@nite/editorial";
import {
  auditEvents,
  articles,
  cmsMemberships,
  mediaAssets,
  outboxEvents,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);
const coverMediaId = "30000000-0000-4000-8000-000000000100";
const draftInput = {
  slug: "laboratorio-de-inovacao",
  title: "Laboratório de inovação abre nova agenda",
  summary:
    "A equipe do NITE apresenta uma agenda editorial validada para atividades acadêmicas e projetos aplicados.",
  category: "inovacao" as const,
  byline: "Redação NITE",
  coverMediaId,
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

type DomainCommand = (...arguments_: readonly unknown[]) => unknown;

function command(name: string): DomainCommand {
  const candidate: unknown = Reflect.get(editorial, name);
  expect(candidate, `export ${name}`).toBeTypeOf("function");
  if (typeof candidate !== "function") {
    throw new Error(`export ${name} ausente`);
  }
  return (...arguments_) => Reflect.apply(candidate, undefined, arguments_);
}

describe("ciclo editorial", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  async function createPublishedArticle() {
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
      id: coverMediaId,
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
      slugManuallyEdited: true,
      input: draftInput,
    });
    const published = await publishArticle(database, {
      actor: publisher,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
    });
    return { database, publisher, created, published };
  }

  it("despublica com revisão esperada, preserva a primeira publicação e não agenda revalidação", async () => {
    const { database, publisher, created, published } =
      await createPublishedArticle();

    await Reflect.apply(command("unpublishArticle"), undefined, [
      database,
      {
        actor: publisher,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
      },
    ]);

    const [unpublished] = await database
      .select()
      .from(articles)
      .where(eq(articles.id, created.article.id));
    expect(unpublished).toMatchObject({
      status: "draft",
      publishedRevisionId: created.revision.id,
      publishedAt: published.publishedAt,
    });
    await expect(database.select().from(outboxEvents)).resolves.toEqual([]);

    const republished = await publishArticle(database, {
      actor: publisher,
      articleId: created.article.id,
      expectedRevisionId: created.revision.id,
    });
    expect(republished.publishedAt).toEqual(published.publishedAt);
  });

  it("arquiva conteúdo público, restaura sempre para draft e não permite slug já publicado", async () => {
    const { database, publisher, created } = await createPublishedArticle();

    await Reflect.apply(command("archiveArticle"), undefined, [
      database,
      {
        actor: publisher,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
      },
    ]);
    await Reflect.apply(command("restoreArticle"), undefined, [
      database,
      {
        actor: publisher,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
      },
    ]);

    await expect(
      database
        .select({ status: articles.status })
        .from(articles)
        .where(eq(articles.id, created.article.id)),
    ).resolves.toEqual([{ status: "draft" }]);
    await expect(database.select().from(outboxEvents)).resolves.toEqual([]);
    await expect(
      saveArticleRevision(database, {
        actor: publisher,
        articleId: created.article.id,
        expectedRevisionId: created.revision.id,
        input: { ...draftInput, slug: "novo-slug-indevido" },
      }),
    ).rejects.toBeInstanceOf(EditorialPublicationError);
  });

  it("rejeita transição com expectedRevisionId obsoleto sem inserir outbox", async () => {
    const { database, publisher, created } = await createPublishedArticle();

    await expect(
      Reflect.apply(command("archiveArticle"), undefined, [
        database,
        {
          actor: publisher,
          articleId: created.article.id,
          expectedRevisionId: "20000000-0000-4000-8000-000000000999",
        },
      ]),
    ).rejects.toBeInstanceOf(EditorialConflictError);
    await expect(database.select().from(outboxEvents)).resolves.toHaveLength(0);
  });

  it("arquiva sem inserir evento editorial no outbox", async () => {
    const { database, publisher, created } = await createPublishedArticle();
    await client.exec(`
      CREATE FUNCTION reject_archived_article_outbox() RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.topic = 'news.article.archived' THEN
          RAISE EXCEPTION 'outbox indisponível';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER reject_archived_article_outbox_trigger
      BEFORE INSERT ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION reject_archived_article_outbox();
    `);

    await expect(
      Reflect.apply(command("archiveArticle"), undefined, [
        database,
        {
          actor: publisher,
          articleId: created.article.id,
          expectedRevisionId: created.revision.id,
        },
      ]),
    ).resolves.toMatchObject({ status: "archived" });
    await expect(
      database
        .select({ status: articles.status })
        .from(articles)
        .where(eq(articles.id, created.article.id)),
    ).resolves.toEqual([{ status: "archived" }]);
    await expect(
      database
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.aggregateId, created.article.id)),
    ).resolves.toHaveLength(3);
    await expect(
      database
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.aggregateId, created.article.id)),
    ).resolves.toHaveLength(0);
  });
});
