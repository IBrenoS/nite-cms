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
    const bodyMediaId = "30000000-0000-4000-8000-000000000004";

    await client.query(
      `insert into media_assets
        (id, object_key, mime_type, byte_size, width, height, checksum_sha256, status)
       values ($1, 'news/capa.webp', 'image/webp', 2048, 1200, 675,
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'ready')`,
      [mediaId],
    );
    await client.query(
      `insert into media_assets
        (id, object_key, mime_type, byte_size, width, height, checksum_sha256, status)
       values ($1, 'news/imagem.webp', 'image/webp', 2048, 800, 600,
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'ready')`,
      [bodyMediaId],
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
           jsonb_build_object(
             'schemaVersion', 1,
             'type', 'doc',
             'content', jsonb_build_array(
               jsonb_build_object(
                 'type', 'paragraph',
                 'content', jsonb_build_array(
                   jsonb_build_object('type', 'text', 'text', 'Texto editorial suficientemente longo para validar o contrato publico.')
                 )
               ),
               jsonb_build_object(
                 'type', 'image',
                 'attrs', jsonb_build_object('mediaId', $5::text, 'alt', 'Atividade universitária em laboratório.')
               )
             )
           ))`,
        [id, articleId, title, mediaId, bodyMediaId],
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
      body_media: Record<
        string,
        { objectKey: string; width: number; height: number }
      >;
    }>(
      "select slug, title, public, content_state, cover_object_key, body_media from published_articles",
    );

    expect(result.rows).toEqual([
      {
        slug: "materia-publicada",
        title: "Materia publicada oficial",
        public: true,
        content_state: "real",
        cover_object_key: "news/capa.webp",
        body_media: {
          [bodyMediaId]: {
            objectKey: "news/imagem.webp",
            width: 800,
            height: 600,
          },
        },
      },
    ]);
  });

  it("resolve imagens aninhadas prontas e omite matéria com imagem aninhada não pronta", async () => {
    const readyArticleId = "10000000-0000-4000-8000-000000000021";
    const pendingArticleId = "10000000-0000-4000-8000-000000000022";
    const readyRevisionId = "20000000-0000-4000-8000-000000000021";
    const pendingRevisionId = "20000000-0000-4000-8000-000000000022";
    const coverMediaId = "30000000-0000-4000-8000-000000000021";
    const readyBodyMediaId = "30000000-0000-4000-8000-000000000022";
    const pendingBodyMediaId = "30000000-0000-4000-8000-000000000023";

    await client.query(
      `insert into media_assets
        (id, object_key, mime_type, byte_size, width, height, checksum_sha256, status)
       values
        ($1, 'news/capa-aninhada.webp', 'image/webp', 2048, 1200, 675,
         '1111111111111111111111111111111111111111111111111111111111111111', 'ready'),
        ($2, 'news/imagem-aninhada.webp', 'image/webp', 2048, 800, 600,
         '2222222222222222222222222222222222222222222222222222222222222222', 'ready'),
        ($3, 'news/imagem-pendente.webp', 'image/webp', 2048, 640, 480,
         '3333333333333333333333333333333333333333333333333333333333333333', 'processing')`,
      [coverMediaId, readyBodyMediaId, pendingBodyMediaId],
    );

    for (const [id, slug] of [
      [readyArticleId, "imagem-aninhada-pronta"],
      [pendingArticleId, "imagem-aninhada-pendente"],
    ] as const) {
      await client.query(
        "insert into articles (id, slug, status) values ($1, $2, 'draft')",
        [id, slug],
      );
    }

    for (const [revisionId, articleId, bodyMediaId] of [
      [readyRevisionId, readyArticleId, readyBodyMediaId],
      [pendingRevisionId, pendingArticleId, pendingBodyMediaId],
    ] as const) {
      await client.query(
        `insert into article_revisions
          (id, article_id, version, content_schema_version, title, summary,
           category, read_time_minutes, byline, cover_media_id, cover_alt, body)
         values ($1, $2, 1, 1, 'Matéria com imagem aninhada',
          'Resumo editorial suficientemente descritivo para validar mídia aninhada.',
          'projetos', 1, 'Redação NITE', $3,
          'Pessoas reunidas em um ambiente universitário iluminado.',
          jsonb_build_object(
            'schemaVersion', 1,
            'type', 'doc',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'blockquote',
                'content', jsonb_build_array(
                  jsonb_build_object(
                    'type', 'bulletList',
                    'content', jsonb_build_array(
                      jsonb_build_object(
                        'type', 'listItem',
                        'content', jsonb_build_array(
                          jsonb_build_object(
                            'type', 'image',
                            'attrs', jsonb_build_object(
                              'mediaId', $4::text,
                              'alt', 'Atividade universitária em laboratório.'
                            )
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          ))`,
        [revisionId, articleId, coverMediaId, bodyMediaId],
      );
      await client.query(
        `update articles
         set current_revision_id = $2, published_revision_id = $2,
             published_at = now() - interval '1 hour', status = 'published'
         where id = $1`,
        [articleId, revisionId],
      );
    }

    const result = await client.query<{
      slug: string;
      body_media: Record<
        string,
        { objectKey: string; width: number; height: number }
      >;
    }>("select slug, body_media from published_articles order by slug");

    expect(result.rows).toEqual([
      {
        slug: "imagem-aninhada-pronta",
        body_media: {
          [readyBodyMediaId]: {
            objectKey: "news/imagem-aninhada.webp",
            width: 800,
            height: 600,
          },
        },
      },
    ]);
  });

  it("migra os papéis legados para publisher sem ativar antigos authors", async () => {
    await client.exec(`
      DROP VIEW IF EXISTS "published_articles";
      ALTER TABLE "article_revisions"
      DROP CONSTRAINT "article_revisions_body_root_check";
      ALTER TYPE "cms_role" RENAME TO "cms_role_current";
      CREATE TYPE "cms_role" AS ENUM('admin', 'editor', 'author');
      ALTER TABLE "cms_memberships"
      ALTER COLUMN "role" TYPE "cms_role"
      USING "role"::text::"cms_role";
      DROP TYPE "cms_role_current";
      DELETE FROM "drizzle"."__drizzle_migrations"
      WHERE id >= (
        SELECT max(id) - 1 FROM "drizzle"."__drizzle_migrations"
      );
    `);
    await client.query(
      `insert into cms_memberships
        (tenant_id, object_id, display_name, role, active)
       values
        ('tenant-nite', 'editor-legado', 'Editora legada', 'editor', true),
        ('tenant-nite', 'author-legado', 'Autora legada', 'author', true)`,
    );

    await migrate(drizzle(client), { migrationsFolder });

    const memberships = await client.query<{
      object_id: string;
      role: string;
      active: boolean;
    }>(
      `select object_id, role, active
       from cms_memberships
       order by object_id`,
    );

    expect(memberships.rows).toEqual([
      { object_id: "author-legado", role: "publisher", active: false },
      { object_id: "editor-legado", role: "publisher", active: true },
    ]);
    await expect(
      client.query(
        `insert into cms_memberships
          (tenant_id, object_id, display_name, role)
         values ('tenant-nite', 'role-legada', 'Role legada', 'editor')`,
      ),
    ).rejects.toThrow(/invalid input value for enum cms_role/i);
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
         '{"schemaVersion":1,"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Texto editorial suficientemente longo para validar o contrato publico."}]}]}'::jsonb)`,
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
