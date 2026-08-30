# NITE CMS

CMS editorial independente do Portal NITE. O repositório contém o painel administrativo, a API pública de notícias e os módulos privados de persistência e domínio.

## Aplicações

- `apps/admin`: autenticação Entra/Better Auth, editor Tiptap, memberships, revisões, mídia em dois buckets, preview privado, ciclo editorial, auditoria e outbox.
- `apps/api`: `GET /v2/news`, `GET /v2/news/{slug}` e `GET /health`.

O domínio fica em `packages/editorial`, a persistência e as migrations em
`packages/db` e a UI exclusiva do painel em `packages/cms-ui`. Os únicos papéis
são `publisher | admin`; os estados editoriais são
`draft | published | archived`. O corpo canônico é `EditorialDocumentV1`, sem
payload legado paralelo.

## Fronteira com o Portal

Não existe package, workspace, import ou path compartilhado com o Portal. A comunicação é feita pela API pública versionada e pelo webhook HMAC de revalidação. O checkout opcional deste repositório como submodule no Portal é apenas uma referência Git.

O preview também cruza essa fronteira por HTTPS: o Admin emite o token HMAC e
resolve a revisão exata em `POST /api/preview/resolve`; o Portal mantém o Draft
Mode e nunca recebe `PREVIEW_HMAC_SECRET`.

## Desenvolvimento

```bash
npm ci
npm run dev
npm run dev:api
npm run check
```

Migrations são propriedade exclusiva de `packages/db` e devem ser aplicadas com credenciais próprias:

```bash
npm run db:migrate
```

Não execute migrations de produção a partir de builds do Admin ou da API.

Consulte `docs/runbooks/cms-rollout.md` para as variáveis separadas do Admin,
API, Portal e migration. O runbook não contém valores de credenciais e não
autoriza deploy ou migration.
