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

O deploy em VM Linux mantém Neon, Cloudflare R2 e Microsoft Entra externos. A
VM executa somente Caddy, Admin, API pública e scheduler do outbox por Docker
Compose. Admin e API usam imagens Next.js standalone e não publicam portas no
host; apenas Caddy publica `80/443`.

```bash
cp deploy/vm/stack.env.example deploy/vm/stack.env
cp deploy/vm/admin.env.example deploy/vm/admin.env
cp deploy/vm/api.env.example deploy/vm/api.env
cp deploy/vm/scheduler.env.example deploy/vm/scheduler.env
cp deploy/vm/migration.env.example deploy/vm/migration.env
```

Depois de preencher os arquivos locais, valide a configuração antes de
construir ou iniciar os serviços:

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml config --quiet
docker compose --env-file deploy/vm/stack.env -f compose.production.yml build admin api outbox-scheduler migration
docker compose --env-file deploy/vm/stack.env -f compose.production.yml --profile operations run --rm migration
docker compose --env-file deploy/vm/stack.env -f compose.production.yml up -d
```

A migration é uma operação manual separada. Ela não é executada em `build`,
`up`, restart nem health check. Consulte
[`docs/runbooks/cms-vm-deployment.md`](docs/runbooks/cms-vm-deployment.md) para
preparação da VM, DNS, Entra, secrets, smoke tests, observabilidade e rollback.

A topologia anterior por integração Git da Vercel continua documentada como
alternativa com dois projetos independentes:

- `nite-cms-admin`, com Root Directory `apps/admin`;
- `nite-cms-api`, com Root Directory `apps/api`.

Cada projeto mantém somente as variáveis exigidas pela sua responsabilidade.
Migrations não fazem parte do build ou do deploy.

Consulte `docs/runbooks/cms-rollout.md` para o corte coordenado de Admin, API e
Portal. Os runbooks não contêm credenciais nem autorizam, por si só, uma
migration ou publicação em produção.

Para provisionar e homologar o envio transacional de convites, consulte
[`docs/runbooks/resend-membership-invitations.md`](docs/runbooks/resend-membership-invitations.md).
