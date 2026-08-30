# Rollout do CMS e corte do Nite News

## Limite deste runbook

Este documento descreve a homologação coordenada de três aplicações
independentes: CMS Admin, CMS API e Portal. Ele não autoriza migration, deploy,
alteração de secrets ou publicação de conteúdo em produção.

## Pré-requisitos

- projetos separados para `apps/admin`, `apps/api` e o Portal;
- PostgreSQL/Neon com SSL e logins distintos de migration, Admin e API pública;
- tenant e aplicação Microsoft Entra do domínio do Admin;
- `R2_STAGING_BUCKET` privado, com CORS de upload limitado ao Admin;
- `R2_PUBLIC_BUCKET` servido pela URL HTTPS de `R2_PUBLIC_BASE_URL`;
- domínios HTTPS do Admin, API, Portal e mídia;
- identidades de teste `admin`, `publisher` e não autorizada;
- uma imagem e uma matéria aprovadas somente para homologação;
- secrets independentes de Better Auth, revalidação, cron e preview.

Nenhum valor de credencial deve ser armazenado no repositório ou em logs.

## Configuração por responsabilidade

### Migration

- `DATABASE_MIGRATION_URL`: login com ownership/DDL e permissão para criar os
  group roles `nite_admin` e `nite_public`.

Com a variável disponível somente no ambiente do operador, o comando da raiz
do CMS é:

```text
npm run db:migrate
```

Não execute o comando como parte de build ou deploy. Depois da migration, crie
os logins de runtime fora do repositório e conceda os group roles previstos.

As migrations do documento v1 e dos dois buckets pressupõem ausência de dados
e objetos reais legados. Não fazem conversão de corpo anterior, backfill de
`object_key`, cópia entre buckets nem fallback. Se a premissa não for verdadeira
no ambiente alvo, interrompa o rollout e planeje uma migration de dados
separada.

### CMS Admin

- `DATABASE_ADMIN_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `CMS_BOOTSTRAP_ADMIN_OID`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_STAGING_BUCKET`: bucket privado dos originais; sem deleção no MVP.
- `R2_PUBLIC_BUCKET`: bucket dos WebPs processados sob chaves imutáveis.
- `R2_PUBLIC_BASE_URL`: base HTTPS pública usada para resolver a mídia.
- `PORTAL_PREVIEW_URL`: URL HTTPS exata de `GET /api/preview` no Portal.
- `PREVIEW_HMAC_SECRET`: secret exclusivo de preview, com pelo menos 32
  caracteres; não compartilhar com o Portal.
- `WEB_REVALIDATION_URL`: URL HTTPS exata de `/api/revalidate/news` no Portal.
- `REVALIDATION_SECRET`: pelo menos 32 caracteres, igual no Admin e Portal.
- `CRON_SECRET`: pelo menos 32 caracteres, exclusivo do cron.

O usuário/role R2 do Admin precisa apenas das operações usadas para upload no
staging, leitura do staging e escrita no bucket público. `DeleteObject` não é
necessário. Configure CORS do staging somente para origem, métodos e headers do
Admin.

O cron versionado chama `/api/cron/outbox` diariamente às `06:00 UTC`. A
tentativa em `after()` reduz a latência; o cron é a recuperação durável. No
plano Hobby, a execução pode ocorrer em qualquer ponto da hora, portanto uma
indisponibilidade prolongada pode aguardar o próximo ciclo.

### CMS API

- `DATABASE_PUBLIC_URL`: login com `SELECT` somente em `published_articles`.
- `R2_PUBLIC_BASE_URL`: a mesma base HTTPS pública usada pelo Admin.

A API não recebe Better Auth, Entra, `DATABASE_ADMIN_URL`, credenciais R2 de
escrita, `PREVIEW_HMAC_SECRET`, `REVALIDATION_SECRET` ou `CRON_SECRET`.

### Portal

- `CMS_PUBLIC_API_URL`: origem HTTPS da CMS API; o client consome `/v2/news`.
- `NITE_NEWS_SOURCE=api`: fonte pública real. `static` é somente teste,
  desenvolvimento e rollback explícito.
- `NITE_NEWS_MEDIA_URL`: base HTTPS pública autorizada no Next Image.
- `CMS_PREVIEW_RESOLVE_URL`: URL HTTPS exata de
  `POST /api/preview/resolve` no CMS Admin.
- `REVALIDATION_SECRET`: o mesmo valor do CMS Admin.

O Portal não recebe `PREVIEW_HMAC_SECRET`, credenciais de banco do CMS ou
credenciais R2. Não há fallback automático se API ou configuração falharem.

### Playwright do Admin em homologação

- `ADMIN_E2E_BASE_URL`
- `ADMIN_E2E_ADMIN_STORAGE_STATE`
- `ADMIN_E2E_PUBLISHER_STORAGE_STATE`
- `ADMIN_E2E_ARTICLE_ID`

Os storage states são artefatos sensíveis do ambiente de teste e não devem ser
versionados.

## Ordem de homologação

1. Faça backup e, com autorização operacional, aplique migrations usando
   somente `DATABASE_MIGRATION_URL`.
2. Prove que a API lê a view e não lê/escreve tabelas-base; prove que o Admin
   escreve apenas pelo papel previsto.
3. Configure buckets, CORS, domínios e variáveis, sem reutilizar secrets entre
   preview, revalidação, cron e autenticação.
4. Publique CMS Admin e CMS API v2; valide `/health`, `/v2/news` e um 404 de
   slug inexistente antes de conectar conteúdo real.
5. Publique o Portal já configurado para v2. Não publique a primeira matéria
   enquanto API e Portal não estiverem no mesmo contrato.
6. Entre como identidade não autorizada, `publisher` e `admin`. Confirme acesso
   negado, permissões editoriais e exclusividade da gestão de memberships.
7. Faça upload JPEG/PNG/WebP autorizado. Confirme original no staging,
   processamento sem EXIF, dimensão máxima de 2400 px, WebP público, cache
   immutable, estado `ready` e alt obrigatório.
8. Crie e salve uma matéria; confirme revisão imutável e conflito por
   `expectedRevisionId` desatualizado.
9. Abra preview de uma matéria nunca publicada. Confirme Draft Mode, faixa
   “Prévia — ainda não publicada”, isolamento por slug/revisão,
   `noindex,nofollow`, ausência de canonical/JSON-LD, `no-referrer`, no-store e
   saída por POST.
10. Teste tokens válido, expirado, adulterado e de revisão inexistente. Somente
    o válido pode habilitar Draft Mode.
11. Publique, despublique, republique, arquive e restaure. Confirme primeira
    `publishedAt`, slug bloqueado, auditoria, outbox, 404 quando fora do ar,
    revalidação de lista/artigo/filtros/sitemap e restauração em draft.
12. Acione o cron com e sem Bearer correto e verifique `200` e `401` sem secret
    em logs. Prove recuperação de uma falha transitória da outbox.
13. Execute Playwright desktop/mobile do Admin com storage states dedicados e
    faça smoke visual do corpo rico e preview no Portal.

## Corte de produção

O corte só está liberado após todos os passos de homologação e aprovação do
conteúdo oficial. Aplicar CMS/migrations e Portal é uma operação coordenada:
CMS Admin/API v2 primeiro, Portal v2 imediatamente depois, sem publicar a
primeira matéria durante a janela intermediária. Faça smoke de
`/atualizacoes`, slug, sitemap, preview e revalidação; monitore API, outbox e
processamento de mídia.

## Rollback

1. Suspenda novas mutações editoriais enquanto a causa é investigada.
2. Se o Portal estiver saudável com fixtures, configure explicitamente
   `NITE_NEWS_SOURCE=static` e faça novo deploy; isso não altera dados do CMS.
3. Não reverta migrations automaticamente nem exclua objetos R2: preserve
   dados, originais, outbox e auditoria.
4. Corrija o ambiente, restaure `NITE_NEWS_SOURCE=api`, reprocesse a recuperação
   normal da outbox e repita todo smoke relevante antes de reabrir o fluxo.

## Pendência desta implementação

Nenhum passo acima foi executado contra staging nesta entrega por ausência de
credenciais e recursos provisionados. O código e os checks locais não
substituem esse aceite operacional.
