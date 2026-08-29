# NITE CMS

CMS editorial independente do Portal NITE. O repositório contém o painel administrativo, a API pública de notícias e os módulos privados de persistência e domínio.

## Aplicações

- `apps/admin`: autenticação Entra/Better Auth, editor, revisões, mídia, preview, publicação, auditoria e outbox.
- `apps/api`: `GET /v2/news`, `GET /v2/news/{slug}` e `GET /health`.

## Fronteira com o Portal

Não existe package, workspace, import ou path compartilhado com o Portal. A comunicação é feita pela API pública versionada e pelo webhook HMAC de revalidação. O checkout opcional deste repositório como submodule no Portal é apenas uma referência Git.

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
