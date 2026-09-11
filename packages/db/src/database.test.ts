import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const legacyRolesMigrationPath = fileURLToPath(
  new URL("../drizzle/0005_editorial_roles.sql", import.meta.url),
);
const slugStateMigrationPath = fileURLToPath(
  new URL("../drizzle/0008_slug_manual_state.sql", import.meta.url),
);

describe("persistencia editorial", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("aceita documentos editoriais V1, V2 e V3 no constraint raiz", async () => {
    const articleId = "10000000-0000-4000-8000-000000000099";
    await client.query(
      `insert into articles (id, slug) values ($1, 'documentos-v1-v2')`,
      [articleId],
    );
    for (const schemaVersion of [1, 2, 3]) {
      await expect(
        client.query(
          `insert into article_revisions
            (article_id, version, content_schema_version, title, summary,
             category, read_time_minutes, byline, cover_alt, body)
           values ($1, $2, $2, 'Titulo editorial', 'Resumo editorial',
             'inovacao', 1, 'Redacao NITE', '', $3::jsonb)`,
          [
            articleId,
            schemaVersion,
            JSON.stringify({ schemaVersion, type: "doc", content: [] }),
          ],
        ),
      ).resolves.toBeDefined();
    }
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
        (id, staging_object_key, public_object_key, mime_type, byte_size, width, height, checksum_sha256, status)
       values ($1, 'incoming/capa/original', 'news/capa.webp', 'image/webp', 2048, 1200, 675,
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'ready')`,
      [mediaId],
    );
    await client.query(
      `insert into media_assets
        (id, staging_object_key, public_object_key, mime_type, byte_size, width, height, checksum_sha256, status)
       values ($1, 'incoming/imagem/original', 'news/imagem.webp', 'image/webp', 2048, 800, 600,
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
           category, read_time_minutes, byline, cover_media_id, cover_alt,
           cover_caption, cover_credit, body)
         values ($1::uuid, $2, 1, 1, $3,
          'Resumo editorial suficientemente descritivo para validar a view publica.',
          'comunidade', 4, 'Redacao NITE', $4,
          'Pessoas reunidas em um ambiente universitario iluminado.',
          case when $1::text = '${publishedRevisionId}' then 'Encontro da comunidade acadêmica.' end,
          case when $1::text = '${publishedRevisionId}' then 'Foto: Comunicação NITE' end,
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
      cover_caption: string | null;
      cover_credit: string | null;
      body_media: Record<
        string,
        {
          mediaKind: string;
          objectKey: string;
          mimeType: string;
          width: number;
          height: number;
        }
      >;
    }>(
      "select slug, title, public, content_state, cover_object_key, cover_caption, cover_credit, body_media from published_articles",
    );

    expect(result.rows).toEqual([
      {
        slug: "materia-publicada",
        title: "Materia publicada oficial",
        public: true,
        content_state: "real",
        cover_object_key: "news/capa.webp",
        cover_caption: "Encontro da comunidade acadêmica.",
        cover_credit: "Foto: Comunicação NITE",
        body_media: {
          [bodyMediaId]: {
            mediaKind: "image",
            objectKey: "news/imagem.webp",
            mimeType: "image/webp",
            width: 800,
            height: 600,
          },
        },
      },
    ]);
  });

  it("persiste snapshots temporarios sem criar uma nova revisao editorial", async () => {
    const membershipId = "00000000-0000-4000-8000-000000000001";
    const articleId = "10000000-0000-4000-8000-000000000091";
    const revisionId = "20000000-0000-4000-8000-000000000091";
    const snapshotId = "40000000-0000-4000-8000-000000000091";
    await client.query(
      `insert into cms_memberships
        (id, tenant_id, object_id, display_name, role)
       values ($1, 'tenant-nite', 'preview-author', 'Preview Author', 'publisher')`,
      [membershipId],
    );
    await client.query(
      "insert into articles (id, slug, status) values ($1, 'preview-ao-vivo', 'draft')",
      [articleId],
    );
    await client.query(
      `insert into article_revisions
        (id, article_id, version, title, summary, category, read_time_minutes,
         byline, cover_alt, body, created_by_membership_id)
       values ($1, $2, 3, 'Titulo salvo anteriormente',
        'Resumo editorial salvo anteriormente com tamanho suficiente para o teste.',
        'inovacao', 2, 'Redacao NITE', '',
        '{"schemaVersion":1,"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb,
        $3)`,
      [revisionId, articleId, membershipId],
    );
    await client.query(
      "update articles set current_revision_id = $2 where id = $1",
      [articleId, revisionId],
    );

    await client.query(
      `insert into preview_snapshots
        (id, article_id, base_revision_id, actor_membership_id, payload, expires_at)
       values ($1, $2, $3, $4, $5::jsonb, now() + interval '10 minutes')`,
      [
        snapshotId,
        articleId,
        revisionId,
        membershipId,
        JSON.stringify({ title: "Titulo ainda nao salvo" }),
      ],
    );

    const snapshots = await client.query<{ title: string }>(
      "select payload ->> 'title' as title from preview_snapshots where id = $1",
      [snapshotId],
    );
    const revisions = await client.query<{ count: number }>(
      "select count(*)::int as count from article_revisions where article_id = $1",
      [articleId],
    );
    expect(snapshots.rows).toEqual([{ title: "Titulo ainda nao salvo" }]);
    expect(revisions.rows).toEqual([{ count: 1 }]);
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
        (id, staging_object_key, public_object_key, mime_type, byte_size, width, height, checksum_sha256, status)
       values
        ($1, 'incoming/capa-aninhada/original', 'news/capa-aninhada.webp', 'image/webp', 2048, 1200, 675,
         '1111111111111111111111111111111111111111111111111111111111111111', 'ready'),
        ($2, 'incoming/imagem-aninhada/original', 'news/imagem-aninhada.webp', 'image/webp', 2048, 800, 600,
         '2222222222222222222222222222222222222222222222222222222222222222', 'ready'),
        ($3, 'incoming/imagem-pendente/original', null, 'image/webp', 2048, 640, 480,
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
        {
          mediaKind: string;
          objectKey: string;
          mimeType: string;
          width: number;
          height: number;
        }
      >;
    }>("select slug, body_media from published_articles order by slug");

    expect(result.rows).toEqual([
      {
        slug: "imagem-aninhada-pronta",
        body_media: {
          [readyBodyMediaId]: {
            mediaKind: "image",
            objectKey: "news/imagem-aninhada.webp",
            mimeType: "image/webp",
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
      DROP TABLE "cms_membership_invitations";
      DROP TYPE "cms_membership_invitation_status";
      ALTER TABLE "article_revisions"
      DROP CONSTRAINT "article_revisions_body_root_check";
      ALTER TYPE "cms_role" RENAME TO "cms_role_current";
      CREATE TYPE "cms_role" AS ENUM('admin', 'editor', 'author');
      ALTER TABLE "cms_memberships"
      ALTER COLUMN "role" TYPE "cms_role"
      USING "role"::text::"cms_role";
      DROP TYPE "cms_role_current";
    `);
    await client.query(
      `insert into cms_memberships
        (tenant_id, object_id, display_name, role, active)
       values
        ('tenant-nite', 'editor-legado', 'Editora legada', 'editor', true),
        ('tenant-nite', 'author-legado', 'Autora legada', 'author', true)`,
    );

    await client.exec(await readFile(legacyRolesMigrationPath, "utf8"));

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

  it("preserva slugs existentes como manuais e deixa novos artigos no modo automatico", async () => {
    await client.exec(`
      ALTER TABLE "articles" DROP COLUMN IF EXISTS "slug_manually_edited";
      INSERT INTO "articles" ("slug", "status")
      VALUES ('slug-legado-preservado', 'draft');
    `);
    const migration = await readFile(slugStateMigrationPath, "utf8").catch(
      () => "",
    );

    await client.exec(migration);

    const migrated = await client.query<{
      column_default: string;
      is_nullable: string;
      slug: string;
      slug_manually_edited: boolean;
    }>(`
      SELECT columns.column_default, columns.is_nullable,
             articles.slug,
             (to_jsonb(articles) ->> 'slug_manually_edited')::boolean
               AS slug_manually_edited
      FROM information_schema.columns AS columns
      CROSS JOIN articles
      WHERE columns.table_schema = 'public'
        AND columns.table_name = 'articles'
        AND columns.column_name = 'slug_manually_edited'
    `);
    expect(migrated.rows).toEqual([
      {
        column_default: "false",
        is_nullable: "NO",
        slug: "slug-legado-preservado",
        slug_manually_edited: true,
      },
    ]);

    await client.query(
      `INSERT INTO "articles" ("slug", "status")
       VALUES ('novo-slug-automatico', 'draft')`,
    );
    const articles = await client.query<{
      slug: string;
      slug_manually_edited: boolean;
    }>(`
      SELECT slug, slug_manually_edited
      FROM articles
      ORDER BY slug
    `);
    expect(articles.rows).toEqual([
      { slug: "novo-slug-automatico", slug_manually_edited: false },
      { slug: "slug-legado-preservado", slug_manually_edited: true },
    ]);
  });

  it("cria convites institucionais restritos e sem permissao de exclusao", async () => {
    const adminId = "10000000-0000-4000-8000-000000000091";
    await client.query(
      `insert into cms_memberships
        (id, tenant_id, object_id, display_name, email, role)
       values ($1, '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001', 'Admin NITE',
        'admin@unijorge.com', 'admin')`,
      [adminId],
    );

    await client.query(
      `insert into cms_membership_invitations
        (tenant_id, email, role, expires_at, invited_by_membership_id)
       values ('10000000-0000-4000-8000-000000000001',
        'pessoa@unijorge.com', 'publisher', now() + interval '7 days', $1)`,
      [adminId],
    );

    await expect(
      client.query(
        `insert into cms_membership_invitations
          (tenant_id, email, role, expires_at, invited_by_membership_id)
         values ('10000000-0000-4000-8000-000000000001',
          'PESSOA@unijorge.com', 'publisher', now() + interval '7 days', $1)`,
        [adminId],
      ),
    ).rejects.toThrow(/normalizado|check/i);
    await expect(
      client.query(
        `insert into cms_membership_invitations
          (tenant_id, email, role, expires_at, invited_by_membership_id)
         values ('10000000-0000-4000-8000-000000000001',
          'pessoa..invalida@unijorge.com', 'publisher', now() + interval '7 days', $1)`,
        [adminId],
      ),
    ).rejects.toThrow(/check/i);
    await expect(
      client.query(
        `insert into cms_membership_invitations
          (tenant_id, email, role, expires_at, invited_by_membership_id)
         values ('10000000-0000-4000-8000-000000000001',
          'pessoa@unijorge.com', 'publisher', now() + interval '7 days', $1)`,
        [adminId],
      ),
    ).rejects.toThrow(/unique|duplicate/i);

    await client.exec("set role nite_public");
    await expect(
      client.query("select id from cms_membership_invitations"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      client.query(
        `insert into cms_membership_invitations
          (tenant_id, email, role, expires_at, invited_by_membership_id)
         values ('10000000-0000-4000-8000-000000000001',
          'publica@unijorge.com', 'publisher', now() + interval '7 days', $1)`,
        [adminId],
      ),
    ).rejects.toThrow(/permission denied/i);

    await client.exec("reset role; set role nite_admin");
    await expect(
      client.query("select id from cms_membership_invitations"),
    ).resolves.toMatchObject({ rows: [{ id: expect.any(String) }] });
    await expect(
      client.query(
        "update cms_membership_invitations set updated_at = now() returning id",
      ),
    ).resolves.toMatchObject({ rows: [{ id: expect.any(String) }] });
    await expect(
      client.query("delete from cms_membership_invitations"),
    ).rejects.toThrow(/permission denied/i);
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

  it("mantem revisoes imutaveis e permite apenas o cascade autorizado da materia", async () => {
    const articleId = "10000000-0000-4000-8000-000000000011";
    const revisionId = "20000000-0000-4000-8000-000000000011";
    const mediaId = "30000000-0000-4000-8000-000000000011";

    await client.query(
      `insert into media_assets
        (id, staging_object_key, public_object_key, mime_type, byte_size,
         width, height, checksum_sha256, status)
       values ($1, 'incoming/exclusao/original', 'news/exclusao.webp',
        'image/webp', 2048, 1200, 675,
        'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        'ready')`,
      [mediaId],
    );
    await client.query(
      "insert into articles (id, slug, status) values ($1, 'exclusao-segura', 'draft')",
      [articleId],
    );
    await client.query(
      `insert into article_revisions
        (id, article_id, version, content_schema_version, title, summary,
         category, read_time_minutes, byline, cover_media_id, cover_alt, body)
       values ($1, $2, 1, 1, 'Materia para exclusao segura',
        'Resumo editorial suficientemente descritivo para validar a exclusao segura.',
        'projetos', 3, 'Redacao NITE', $3,
        'Ilustracao editorial de uma atividade universitaria.',
        '{"schemaVersion":1,"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Texto editorial para validar o cascade autorizado."}]}]}'::jsonb)`,
      [revisionId, articleId, mediaId],
    );
    await client.query(
      "update articles set current_revision_id = $2 where id = $1",
      [articleId, revisionId],
    );
    await client.query(
      `insert into article_media_references (article_id, media_id)
       values ($1, $2)`,
      [articleId, mediaId],
    );

    await expect(
      client.query("delete from article_revisions where id = $1", [revisionId]),
    ).rejects.toThrow(/imutaveis/i);

    await client.query("begin");
    await client.query(
      "select set_config('nite.cms_delete_article_id', $1, true)",
      [articleId],
    );
    await expect(
      client.query("delete from article_revisions where id = $1", [revisionId]),
    ).rejects.toThrow(/imutaveis/i);
    await client.query("rollback");

    await client.transaction(async (transaction) => {
      await transaction.query(
        "update articles set current_revision_id = null where id = $1",
        [articleId],
      );
      await transaction.query(
        "select set_config('nite.cms_delete_article_id', $1, true)",
        [articleId],
      );
      await transaction.query("delete from articles where id = $1", [
        articleId,
      ]);
    });

    await expect(
      client.query("select id from article_revisions where id = $1", [
        revisionId,
      ]),
    ).resolves.toMatchObject({ rows: [] });
    await expect(
      client.query(
        "select article_id from article_media_references where article_id = $1",
        [articleId],
      ),
    ).resolves.toMatchObject({ rows: [] });
    await expect(
      client.query("select status from media_assets where id = $1", [mediaId]),
    ).resolves.toMatchObject({ rows: [{ status: "ready" }] });
  });

  it("aplica metadados obrigatórios e proibidos conforme o tipo de mídia", async () => {
    await expect(
      client.query(`
        insert into media_assets
          (staging_object_key, public_object_key, media_kind, mime_type,
           byte_size, width, height, duration_ms, video_codec, has_audio,
           object_etag, status)
        values
          ('incoming/video-valido/original', 'news/video-valido.mp4', 'video',
           'video/mp4', 1024, 1920, 1080, 60000, 'avc1.640028', true,
           'etag-video-valido', 'ready')
      `),
    ).resolves.toBeDefined();
    await expect(
      client.query(`
        insert into media_assets
          (staging_object_key, public_object_key, media_kind, mime_type,
           byte_size, checksum_sha256, duration_ms, status)
        values
          ('incoming/legenda-valida/original', 'news/legenda-valida.vtt',
           'captions', 'text/vtt', 128,
           'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1000,
           'ready')
      `),
    ).resolves.toBeDefined();
    await expect(
      client.query(`
        insert into media_assets
          (staging_object_key, public_object_key, media_kind, mime_type,
           byte_size, width, height, duration_ms, video_codec, has_audio,
           status)
        values
          ('incoming/video-sem-etag/original', 'news/video-sem-etag.mp4',
           'video', 'video/mp4', 1024, 1920, 1080, 1000, 'avc1', false,
           'ready')
      `),
    ).rejects.toThrow(/media_assets_ready_metadata_check/);
    await expect(
      client.query(`
        insert into media_assets
          (staging_object_key, media_kind, mime_type, byte_size, width, height,
           status)
        values
          ('incoming/legenda-com-dimensoes/original', 'captions', 'text/vtt',
           128, 640, 480, 'pending')
      `),
    ).rejects.toThrow(/media_assets_kind_metadata_check/);
  });

  it("resolve imagem, vídeo e legenda compatíveis na view publicada V3", async () => {
    const articleId = "10000000-0000-4000-8000-000000000081";
    const revisionId = "20000000-0000-4000-8000-000000000081";
    const coverId = "30000000-0000-4000-8000-000000000081";
    const imageId = "30000000-0000-4000-8000-000000000082";
    const videoId = "30000000-0000-4000-8000-000000000083";
    const captionsId = "30000000-0000-4000-8000-000000000084";
    await client.query(
      `insert into media_assets
        (id, staging_object_key, public_object_key, media_kind, mime_type,
         byte_size, width, height, checksum_sha256, status)
       values
        ($1, 'incoming/view-cover/original', 'news/view-cover.webp', 'image',
         'image/webp', 2048, 1200, 675,
         '1111111111111111111111111111111111111111111111111111111111111111',
         'ready'),
        ($2, 'incoming/view-image/original', 'news/view-image.webp', 'image',
         'image/webp', 1024, 800, 600,
         '2222222222222222222222222222222222222222222222222222222222222222',
         'ready')`,
      [coverId, imageId],
    );
    await client.query(
      `insert into media_assets
        (id, staging_object_key, public_object_key, media_kind, mime_type,
         byte_size, width, height, duration_ms, video_codec, has_audio,
         object_etag, status)
       values
        ($1, 'incoming/view-video/original', 'news/view-video.mp4', 'video',
         'video/mp4', 8192, 1920, 1080, 42500, 'avc1.640028', true,
         'etag-view-video', 'ready')`,
      [videoId],
    );
    await client.query(
      `insert into media_assets
        (id, staging_object_key, public_object_key, media_kind, mime_type,
         byte_size, checksum_sha256, duration_ms, status)
       values
        ($1, 'incoming/view-captions/original', 'news/view-captions.vtt',
         'captions', 'text/vtt', 256,
         '3333333333333333333333333333333333333333333333333333333333333333', 42000,
         'ready')`,
      [captionsId],
    );
    await client.query(
      "insert into articles (id, slug, status) values ($1, 'video-publicado-v3', 'draft')",
      [articleId],
    );
    await client.query(
      `insert into article_revisions
        (id, article_id, version, content_schema_version, title, summary,
         category, read_time_minutes, byline, cover_media_id, cover_alt, body)
       values ($1, $2, 1, 3, 'Vídeo editorial publicado no portal',
        'Resumo editorial suficientemente descritivo para a view pública V3.',
        'inovacao', 1, 'Redação NITE', $3,
        'Equipe reunida durante a apresentação do novo projeto.',
        jsonb_build_object(
          'schemaVersion', 3,
          'type', 'doc',
          'content', jsonb_build_array(
            jsonb_build_object('type', 'image', 'attrs', jsonb_build_object(
              'mediaId', $4::text, 'alt', 'Atividade no laboratório.',
              'layout', 'normal')),
            jsonb_build_object('type', 'video', 'attrs', jsonb_build_object(
              'mediaId', $5::text, 'captionsMediaId', $6::text,
              'playbackMode', 'manual', 'layout', 'wide'))
          )
        ))`,
      [revisionId, articleId, coverId, imageId, videoId, captionsId],
    );
    await client.query(
      `update articles
       set current_revision_id = $2, published_revision_id = $2,
           published_at = now() - interval '1 minute', status = 'published'
       where id = $1`,
      [articleId, revisionId],
    );

    const result = await client.query<{
      body_media: Record<string, Record<string, unknown>>;
    }>("select body_media from published_articles where article_id = $1", [
      articleId,
    ]);

    expect(result.rows).toEqual([
      {
        body_media: {
          [imageId]: {
            mediaKind: "image",
            objectKey: "news/view-image.webp",
            mimeType: "image/webp",
            width: 800,
            height: 600,
          },
          [videoId]: {
            mediaKind: "video",
            objectKey: "news/view-video.mp4",
            mimeType: "video/mp4",
            width: 1920,
            height: 1080,
            durationMs: 42_500,
            videoCodec: "avc1.640028",
            hasAudio: true,
          },
          [captionsId]: {
            mediaKind: "captions",
            objectKey: "news/view-captions.vtt",
            mimeType: "text/vtt",
            durationMs: 42_000,
          },
        },
      },
    ]);
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
