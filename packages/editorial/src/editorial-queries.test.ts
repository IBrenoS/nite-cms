import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import * as editorial from "@nite/editorial";
import {
  articleRevisions,
  articles,
  cmsMemberships,
  mediaAssets,
  type CmsMembership,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);

type DashboardQuery = (
  database: unknown,
  actor: CmsMembership,
  filters?: {
    search?: string;
    status?: "draft" | "published" | "archived";
    category?: string;
  },
) => Promise<{
  counts: { draft: number; published: number; archived: number };
  records: Array<{
    article: { slug: string; status: string };
    revision: { title: string; category: string } | null;
    cover: { publicObjectKey: string | null; status: string } | null;
  }>;
}>;

function getDashboardQuery(): DashboardQuery {
  const candidate: unknown = Reflect.get(
    editorial,
    "getEditorialArticlesDashboard",
  );
  expect(candidate, "export getEditorialArticlesDashboard").toBeTypeOf(
    "function",
  );
  if (typeof candidate !== "function") {
    throw new Error("getEditorialArticlesDashboard ausente");
  }
  return candidate as DashboardQuery;
}

describe("consulta do painel editorial", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  async function seedDashboard() {
    const database = drizzle(client, { schema: cmsSchema });
    const [publisher] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "publisher-dashboard-oid",
        displayName: "Publisher Dashboard",
        role: "publisher",
      })
      .returning();

    const articleIds = {
      draft: "10000000-0000-4000-8000-000000000001",
      published: "10000000-0000-4000-8000-000000000002",
      archived: "10000000-0000-4000-8000-000000000003",
    } as const;
    const revisionIds = {
      draft: "20000000-0000-4000-8000-000000000001",
      published: "20000000-0000-4000-8000-000000000002",
      archived: "20000000-0000-4000-8000-000000000003",
    } as const;
    const coverId = "30000000-0000-4000-8000-000000000001";

    await database.insert(mediaAssets).values({
      id: coverId,
      stagingObjectKey: "incoming/dashboard-cover/original",
      publicObjectKey: "news/dashboard-cover/processed.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "ready",
      createdByMembershipId: publisher.id,
    });
    await database.insert(articles).values([
      {
        id: articleIds.draft,
        slug: "agenda-cultural-da-semana",
        createdByMembershipId: publisher.id,
        updatedByMembershipId: publisher.id,
      },
      {
        id: articleIds.published,
        slug: "cobertura-especial-de-tecnologia",
        createdByMembershipId: publisher.id,
        updatedByMembershipId: publisher.id,
      },
      {
        id: articleIds.archived,
        slug: "entrevista-com-a-comunidade",
        createdByMembershipId: publisher.id,
        updatedByMembershipId: publisher.id,
      },
    ]);
    await database.insert(articleRevisions).values([
      {
        id: revisionIds.draft,
        articleId: articleIds.draft,
        version: 1,
        title: "Agenda cultural da semana",
        summary: "Programação cultural preparada para a comunidade acadêmica.",
        category: "cultura",
        readTimeMinutes: 1,
        byline: "Redação NITE",
        coverAlt: "",
        body: { schemaVersion: 1, type: "doc", content: [] },
        createdByMembershipId: publisher.id,
      },
      {
        id: revisionIds.published,
        articleId: articleIds.published,
        version: 5,
        title: "Cobertura especial do evento de tecnologia",
        summary:
          "Os principais anúncios e conversas do encontro de tecnologia.",
        category: "tecnologia",
        readTimeMinutes: 2,
        byline: "Redação NITE",
        coverMediaId: coverId,
        coverAlt: "Pessoas reunidas durante o evento de tecnologia.",
        body: { schemaVersion: 1, type: "doc", content: [] },
        createdByMembershipId: publisher.id,
      },
      {
        id: revisionIds.archived,
        articleId: articleIds.archived,
        version: 2,
        title: "Entrevista com lideranças da comunidade",
        summary: "Uma conversa sobre os próximos passos da comunidade NITE.",
        category: "comunidade",
        readTimeMinutes: 3,
        byline: "Redação NITE",
        coverAlt: "",
        body: { schemaVersion: 1, type: "doc", content: [] },
        createdByMembershipId: publisher.id,
      },
    ]);
    await database
      .update(articles)
      .set({ currentRevisionId: revisionIds.draft })
      .where(eq(articles.id, articleIds.draft));
    await database
      .update(articles)
      .set({
        currentRevisionId: revisionIds.published,
        publishedRevisionId: revisionIds.published,
        publishedAt: new Date("2026-09-05T18:15:00.000Z"),
        status: "published",
      })
      .where(eq(articles.id, articleIds.published));
    await database
      .update(articles)
      .set({
        currentRevisionId: revisionIds.archived,
        status: "archived",
      })
      .where(eq(articles.id, articleIds.archived));

    return { database, publisher };
  }

  it("mantém os totais de cada estado independentes da busca ativa", async () => {
    const { database, publisher } = await seedDashboard();

    const result = await getDashboardQuery()(database, publisher, {
      search: "tecnologia",
    });

    expect(result.counts).toEqual({ draft: 1, published: 1, archived: 1 });
  });

  it("busca título sem diferenciar maiúsculas e retorna a capa pronta", async () => {
    const { database, publisher } = await seedDashboard();

    const result = await getDashboardQuery()(database, publisher, {
      search: "TECNOLOGIA",
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      article: {
        slug: "cobertura-especial-de-tecnologia",
        status: "published",
      },
      revision: {
        title: "Cobertura especial do evento de tecnologia",
        category: "tecnologia",
      },
      cover: {
        publicObjectKey: "news/dashboard-cover/processed.webp",
        status: "ready",
      },
    });
  });

  it("combina filtros de estado e categoria na fila editorial", async () => {
    const { database, publisher } = await seedDashboard();

    const result = await getDashboardQuery()(database, publisher, {
      status: "archived",
      category: "comunidade",
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      article: { status: "archived" },
      revision: { category: "comunidade" },
    });
  });
});
