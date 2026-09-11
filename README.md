# NITE CMS

CMS editorial independente do Portal NITE. O repositório contém o painel administrativo, a API pública de notícias e os módulos privados de persistência e domínio.

## Aplicações

- `apps/admin`: autenticação Entra/Better Auth, editor Tiptap, memberships, revisões, mídia em dois buckets, preview privado, ciclo editorial, auditoria e outbox.
- `apps/api`: `GET /v2/news`, `GET /v2/news/{slug}` e `GET /health`.

O domínio fica em `packages/editorial`, a persistência e as migrations em
`packages/db` e a UI exclusiva do painel em `packages/cms-ui`. Os únicos papéis
são `publisher | admin`; os estados editoriais são
`draft | published | archived`. A leitura aceita `EditorialDocumentV1`, V2 e
V3; novos salvamentos são gravados em V3 e documentos anteriores são
convertidos somente quando uma nova revisão é salva. A V3 adiciona vídeo MP4
estruturado e legenda WebVTT sem alterar o envelope público `version: 2`.

## Fronteira com o Portal

Não existe package, workspace, import ou path compartilhado com o Portal. A comunicação é feita pela API pública versionada e pelo webhook HMAC de revalidação. O checkout opcional deste repositório como submodule no Portal é apenas uma referência Git.

O preview também cruza essa fronteira por HTTPS: o Admin persiste por dez
minutos um snapshot validado das alterações atuais, emite o token HMAC v2 e o
resolve em `POST /api/preview/resolve`; o Portal mantém o Draft Mode e nunca
recebe `PREVIEW_HMAC_SECRET`. Tokens v1 de revisões salvas continuam aceitos
durante a transição.

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

## Deploy

O repositório privado `IBrenoS/nite-cms` usa a integração Git nativa da Vercel
com dois projetos independentes na branch `main`:

- `nite-cms-admin`, com Root Directory `apps/admin`;
- `nite-cms-api`, com Root Directory `apps/api`.

Cada projeto mantém somente as variáveis exigidas pela sua responsabilidade.
Migrations não fazem parte do build ou do deploy.

Consulte `docs/runbooks/cms-rollout.md` para as variáveis separadas do Admin,
API, Portal e migration. O runbook não contém valores de credenciais e não
autoriza deploy ou migration.
