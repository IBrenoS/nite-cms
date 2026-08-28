import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

describe("persistencia editorial", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("publica somente a revisao fixada de artigos elegiveis", async () => {
    const publishedArticleId = "10000000-0000-4000-8000-000000000001";
    const draftArticleId = "10000000-0000-4000-8000-000000000002";
    const futureArticleId = "10000000-0000-4000-8000-000000000003";
    const publishedRevisionId = "20000000-0000-4000-8000-000000000001";
    const draftRevisionId = "20000000-0000-4000-8000-000000000002";
    const futureRevisionId = "20000000-0000-4000-8000-000000000003";
    const mediaId = "30000000-0000-4000-8000-000000000001";

    await client.query(
      `insert into media_assets
        (id, object_key, mime_type, byte_size, width, height, checksum_sha256, status)
       values ($1, 'news/capa.webp', 'image/webp', 2048, 1200, 675,
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'ready')`,
      [mediaId],
    );

    for (const [id, slug] of [
      [publishedArticleId, "materia-publicada"],
      [draftArticleId, "materia-rascunho"],
      [futureArticleId, "materia-futura"],
    ] as const) {
      await client.query(
        "insert into articles (id, slug, status) values ($1, $2, 'draft')",
        [id, slug],
      );
    }

    for (const [id, articleId, title] of [
      [publishedRevisionId, publishedArticleId, "Materia publicada oficial"],
      [draftRevisionId, draftArticleId, "Materia ainda em rascunho"],
      [futureRevisionId, futureArticleId, "Materia com publicacao futura"],
    ] as const) {
      await client.query(
        `insert into article_revisions
          (id, article_id, version, content_schema_version, title, summary,
           category, read_time_minutes, byline, cover_media_id, cover_alt, body)
         values ($1, $2, 1, 1, $3,
          'Resumo editorial suficientemente descritivo para validar a view publica.',
          'comunidade', 4, 'Redacao NITE', $4,
          'Pessoas reunidas em um ambiente universitario iluminado.',
          '[{"type":"paragraph","text":"Texto editorial suficientemente longo para validar o contrato publico."}]'::jsonb)`,
        [id, articleId, title, mediaId],
      );
    }

    await client.query(
      `update articles
       set current_revision_id = $2, published_revision_id = $2,
           published_at = now() - interval '1 hour', featured = true,
           status = 'published'
       where id = $1`,
      [publishedArticleId, publishedRevisionId],
    );
    await client.query(
      "update articles set current_revision_id = $2 where id = $1",
      [draftArticleId, draftRevisionId],
    );
    await client.query(
      `update articles
       set current_revision_id = $2, published_revision_id = $2,
           published_at = now() + interval '1 day', status = 'published'
       where id = $1`,
      [futureArticleId, futureRevisionId],
    );

    const result = await client.query<{
      slug: string;
      title: string;
      public: boolean;
      content_state: string;
      cover_object_key: string;
    }>(
      "select slug, title, public, content_state, cover_object_key from published_articles",
    );

    expect(result.rows).toEqual([
      {
        slug: "materia-publicada",
        title: "Materia publicada oficial",
        public: true,
        content_state: "real",
        cover_object_key: "news/capa.webp",
      },
    ]);
  });

  it("impede alteracao de uma revisao criada", async () => {
    const articleId = "10000000-0000-4000-8000-000000000010";
    const revisionId = "20000000-0000-4000-8000-000000000010";

    await client.query(
      "insert into articles (id, slug, status) values ($1, 'revisao-imutavel', 'draft')",
      [articleId],
    );
    await client.query(
      `insert into article_revisions
        (id, article_id, version, content_schema_version, title, summary,
         category, read_time_minutes, byline, cover_alt, body)
       values ($1, $2, 1, 1, 'Revisao editorial imutavel',
        'Resumo editorial suficientemente descritivo para validar a imutabilidade.',
        'projetos', 3, 'Redacao NITE',
        'Ilustracao editorial de uma atividade universitaria.',
        '[{"type":"paragraph","text":"Texto editorial suficientemente longo para validar o contrato publico."}]'::jsonb)`,
      [revisionId, articleId],
    );

    await expect(
      client.query(
        "update article_revisions set title = 'Titulo sobrescrito' where id = $1",
        [revisionId],
      ),
    ).rejects.toThrow(/imutaveis/i);
  });

  it("restringe a role publica a view e concede escrita editorial ao admin", async () => {
    await client.exec("set role nite_public");
    await expect(
      client.query("select slug from published_articles"),
    ).resolves.toMatchObject({ rows: [] });
    await expect(client.query("select slug from articles")).rejects.toThrow(
      /permission denied/i,
    );

    await client.exec("reset role; set role nite_admin");
    await expect(
      client.query(
        "insert into articles (slug, status) values ('artigo-do-admin', 'draft') returning slug",
      ),
    ).resolves.toMatchObject({ rows: [{ slug: "artigo-do-admin" }] });
    await expect(
      client.query(
        `insert into auth_users
          (id, name, email, email_verified)
         values ('auth-user-1', 'Admin NITE', 'admin@nite.test', true)
         returning id`,
      ),
    ).resolves.toMatchObject({ rows: [{ id: "auth-user-1" }] });

    await client.exec("reset role; set role nite_public");
    await expect(client.query("select id from auth_users")).rejects.toThrow(
      /permission denied/i,
    );
  });
});
