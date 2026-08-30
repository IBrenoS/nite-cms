# CMS NITE — instruções para agentes

## Contexto

- Monorepo independente npm workspaces/Turbo.
- `apps/admin`: painel editorial, Better Auth/Entra, Server Actions, preview e cron/outbox.
- `apps/api`: API pública read-only versionada em `/v2`.
- `packages/db`: schema Drizzle, migrations, roles e conexão PostgreSQL.
- `packages/editorial`: domínio editorial, validações, publicação, mídia, auditoria e outbox.
- `packages/cms-ui`: UI exclusiva do CMS.

## Fronteiras obrigatórias

- Este repositório não importa arquivos, aliases ou packages do Portal NITE.
- A integração com o Portal ocorre somente por HTTPS e webhook HMAC.
- `packages/db` não depende de `packages/editorial`; JSONB é `unknown` na persistência e validado no domínio.
- Somente o CMS executa migrations.
- `apps/api` usa `DATABASE_PUBLIC_URL` e não recebe secrets de Better Auth, Entra ou escrita R2.
- `apps/admin` usa `DATABASE_ADMIN_URL` e concentra autenticação e comandos editoriais.

## Validação

- Testes direcionados durante a implementação.
- Execute `npm run check` antes de concluir alterações de código.
- Não execute migrations ou deploy de produção sem autorização explícita.
