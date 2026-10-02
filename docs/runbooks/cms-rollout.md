# Rollout do CMS e corte do Nite News

## Limite deste runbook

Este documento descreve a homologação coordenada de três aplicações
independentes: CMS Admin, CMS API e Portal. Ele não autoriza migration, deploy,
alteração de secrets ou publicação de conteúdo em produção.

O provisionamento, a homologação e o rollback do envio de convites estão em
[`resend-membership-invitations.md`](resend-membership-invitations.md). Esse
runbook complementar também exige autorização operacional separada.

## Pré-requisitos

- projetos separados para `apps/admin`, `apps/api` e o Portal;
- PostgreSQL/Neon com SSL e logins distintos de migration, Admin e API pública;
- tenant e aplicação Microsoft Entra do domínio do Admin;
- `R2_STAGING_BUCKET` privado, com CORS de upload limitado ao Admin;
- `R2_PUBLIC_BUCKET` servido pela URL HTTPS de `R2_PUBLIC_BASE_URL`;
- CORS `GET/HEAD` no bucket público para o domínio Vercel do Portal;
- domínios HTTPS do Admin, API, Portal e mídia;
- identidades de teste `admin`, `publisher` e não autorizada;
- uma imagem, um MP4 H.264/AAC, um WebVTT pt-BR e uma matéria aprovados somente
  para homologação;
- secrets independentes de Better Auth, revalidação, cron e preview.

Nenhum valor de credencial deve ser armazenado no repositório ou em logs.

No checkout em submodule do Portal, `npm run env:setup` na raiz
`D:\portal_nite` cria os arquivos locais e gera os quatro secrets internos sem
exibi-los. Os templates versionados ficam ao lado de cada aplicação/package;
credenciais externas continuam sendo preenchidas manualmente. Consulte também
`docs/runbooks/cms-local-environment.md` no repositório do Portal.

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
- `R2_STAGING_BUCKET`: bucket privado dos uploads; MP4/WebVTT promovidos e
  objetos órfãos são removidos pelo outbox.
- `R2_PUBLIC_BUCKET`: bucket de WebP, MP4 e WebVTT processados sob chaves
  imutáveis.
- `R2_PUBLIC_BASE_URL`: base HTTPS pública usada para resolver a mídia.
- `PORTAL_PREVIEW_URL`: URL HTTPS exata de `GET /api/preview` no Portal.
- `PREVIEW_HMAC_SECRET`: secret exclusivo de preview, com pelo menos 32
  caracteres; deve ser idêntico entre emissores e verificadores do CMS Admin,
  mas nunca é compartilhado com o Portal.
- `WEB_REVALIDATION_URL`: URL HTTPS exata de `/api/revalidate/news` no Portal.
- `REVALIDATION_SECRET`: pelo menos 32 caracteres, igual no Admin e Portal.
- `CRON_SECRET`: pelo menos 32 caracteres, exclusivo do cron.

O usuário/role R2 do Admin precisa das operações usadas para upload no staging,
leitura do staging, escrita no bucket público e `DeleteObject` em ambos os
buckets. Restrinja a permissão aos buckets `R2_STAGING_BUCKET` e
`R2_PUBLIC_BUCKET`. Configure CORS do staging somente para origem, métodos e
headers do Admin e CORS `GET/HEAD` no público somente para o domínio Vercel do
Portal.

Em desenvolvimento local, `PORTAL_PREVIEW_URL` vazio é um estado válido e
significa que o Preview no Portal ainda não foi integrado. O Admin permanece
operacional, o Preview no CMS continua disponível e tentativas de usar o Preview
no Portal recebem uma indisponibilidade explícita, sem emitir token.

Para integrar temporariamente o Admin local ao Portal publicado em
`https://portal-nite.vercel.app`, defina:

```text
PORTAL_PREVIEW_URL=https://portal-nite.vercel.app/api/preview
```

Reinicie o Admin depois de alterar `.env.local`. `BETTER_AUTH_URL` e o redirect
URI do Microsoft Entra permanecem locais; o túnel descrito abaixo não publica
rotas de autenticação ou do workspace.

O cron versionado chama `/api/cron/outbox` diariamente às `06:00 UTC`. A
tentativa em `after()` reduz a latência; o cron é a recuperação durável. No
plano Hobby, a execução pode ocorrer em qualquer ponto da hora, portanto uma
indisponibilidade prolongada pode aguardar o próximo ciclo.
Antes de processar o outbox, o mesmo cron remove `preview_snapshots` expirados
e agenda o purge de mídias sem referências criadas há mais de 48 horas; criação
e resolução também fazem a limpeza oportunística dos snapshots.

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

Quando a integração privada for habilitada, configure os dois endpoints HTTPS
em conjunto: `PORTAL_PREVIEW_URL=https://<portal>/api/preview` no Admin e
`CMS_PREVIEW_RESOLVE_URL=https://<admin>/api/preview/resolve` no Portal. O Admin
precisa estar acessível ao servidor do Portal por deploy ou túnel HTTPS. Reinicie
o processo local depois de alterar `.env.local` e faça novo deploy quando a
variável for alterada no provedor do Portal.

### Quick Tunnel para desenvolvimento do preview

Enquanto o CMS Admin não tiver deploy próprio, exponha somente o resolver por
um proxy local restritivo. Inicie, em terminais separados e nesta ordem:

```text
npm run dev
npm run dev:preview-proxy
cloudflared tunnel --url http://127.0.0.1:3011
```

O proxy escuta apenas em `127.0.0.1:3011`, aceita exclusivamente
`POST /api/preview/resolve` e encaminha para o Admin em `127.0.0.1:3001`.
Qualquer outra rota recebe `404`; indisponibilidade ou timeout do Admin recebe
`502 preview_proxy_unavailable`, sempre com cache privado e sem registrar token
ou conteúdo editorial.

Copie a origem HTTPS aleatória emitida pelo `cloudflared` e configure no ambiente
Production do projeto Vercel `portal-nite`:

```text
CMS_PREVIEW_RESOLVE_URL=https://<origem-gerada>.trycloudflare.com/api/preview/resolve
```

Faça redeploy do Portal para aplicar a variável. A origem muda toda vez que o
Quick Tunnel é recriado; portanto a variável e o deployment precisam ser
atualizados em cada nova sessão. Nenhum domínio `nite.tec.br` participa deste
fluxo. Quick Tunnel é somente uma ponte de desenvolvimento, sem SLA, e depende
do Admin, proxy e `cloudflared` permanecerem ativos.

Antes de abrir uma revisão, confirme que um `POST` sem token retorna `401` tanto
em `http://127.0.0.1:3011/api/preview/resolve` quanto na URL pública, e que `/`,
`/articles` e `/api/auth/session` retornam `404` pela URL pública.

Para desativar a integração, remova `CMS_PREVIEW_RESOLVE_URL` da Vercel, faça
novo deployment, esvazie `PORTAL_PREVIEW_URL` no Admin, reinicie-o e encerre o
proxy e o `cloudflared`. O Preview do CMS continua disponível.

### Playwright do Admin em homologação

- `ADMIN_E2E_BASE_URL`
- `ADMIN_E2E_ADMIN_STORAGE_STATE`
- `ADMIN_E2E_PUBLISHER_STORAGE_STATE`
- `ADMIN_E2E_ARTICLE_ID`
- `ADMIN_E2E_INVITATION_EMAIL` (endereço institucional ainda sem membership;
  use um valor exclusivo por execução)

Os storage states são artefatos sensíveis do ambiente de teste e não devem ser
versionados.

O comando `npm run test:e2e:configured` carrega
`apps/admin/.env.e2e.local`. O teste PostgreSQL real usa
`packages/editorial/.env.postgres.local` por meio de
`npm run test:postgres:up` e `npm run test:postgres:local`; encerre o container
descartável com `npm run test:postgres:down`. A migration local pode carregar
`packages/db/.env.local` com `npm run db:migrate:local`; nenhum desses comandos
é executado automaticamente no build.

## Ordem de homologação

1. Publique primeiro o Portal consumidor capaz de ler documentos V1, V2 e V3, sem
   alterar conteúdo editorial.
2. Faça backup e, com autorização operacional, aplique migrations usando
   somente `DATABASE_MIGRATION_URL`.
3. Prove que a API lê a view e não lê/escreve tabelas-base; prove que o Admin
   escreve apenas pelo papel previsto.
4. Configure buckets, CORS, domínios e variáveis, sem reutilizar secrets entre
   preview, revalidação, cron e autenticação.
5. Publique CMS Admin e CMS API v2; valide `/health`, `/v2/news` e um 404 de
   slug inexistente antes de conectar conteúdo real.
6. Não habilite o Admin a produzir V3 antes de Portal, migration 0013 e API estarem
   no mesmo contrato. Não publique uma matéria durante a janela intermediária.
7. Entre como identidade não autorizada, `publisher` e `admin`. Confirme acesso
   negado, permissões editoriais e exclusividade da gestão de equipe.
8. Como admin, crie um convite para um e-mail `@unijorge.com`, comunique a
   pessoa por um canal externo e confirme o aceite em até 7 dias. Verifique que
   o convite ficou `accepted`, que a membership recebeu o `oid` real e que o
   login seguinte continua válido mesmo após uma mudança de e-mail de perfil.
   Para corrigir e-mail ou nível de acesso antes do aceite, use **Corrigir**:
   o convite anterior deve ficar `revoked` e o substituto deve ganhar novo
   prazo. Use **Revogar** para cancelar sem apagar o histórico.
9. Faça upload JPEG/PNG/WebP autorizado. Confirme original no staging,
   processamento sem EXIF, dimensão máxima de 2400 px, WebP público, cache
   immutable, estado `ready` e alt obrigatório.
10. Faça upload direto de MP4 H.264 de até 100 MB e WebVTT pt-BR. Confirme
    progresso/cancelamento/retry, validação de fast-start, codecs, duração e
    cues, promoção pública, purge do staging e CORS `GET/HEAD` no Portal.
11. Crie e salve uma matéria; confirme revisão imutável e conflito por
    `expectedRevisionId` desatualizado.
12. Altere título, resumo, slug, corpo, SEO e mídia sem salvar. Abra Preview no
    CMS e Preview no Portal e confirme os valores atuais, a versão/revisão
    corrente inalterada e ausência de nova `article_revision`. Confirme Draft
    Mode, faixa “Prévia — ainda não publicada”, isolamento por slug/snapshot,
    `noindex,nofollow`, ausência de canonical/JSON-LD, `no-referrer`, no-store e
    saída por POST.
13. Teste tokens v1/v2 válidos, expirados, adulterados, assinados por chave
    divergente e com revisão/snapshot inexistente. Somente os válidos podem
    habilitar Draft Mode. Confirme resposta externa genérica e logs sem token,
    payload editorial ou secret.
14. Valide vídeo manual com controles e track; autoplay mudo, inline, sem
    controles e em loop; limite de 60 segundos e três autoplays; bloqueios de
    navegador, erro de rede e `prefers-reduced-motion` em desktop e mobile.
15. Publique, despublique, republique, arquive e restaure. Confirme primeira
    `publishedAt`, slug bloqueado, auditoria, outbox, 404 quando fora do ar,
    revalidação de lista/artigo/filtros/sitemap e restauração em draft.
16. Acione o cron com e sem Bearer correto e verifique `200` e `401` sem secret
    em logs. Prove recuperação de uma falha transitória da outbox.
17. Execute Playwright desktop/mobile do Admin com storage states dedicados e
    faça smoke visual do corpo rico e preview no Portal.

## Corte de produção

O corte só está liberado após todos os passos de homologação e aprovação do
conteúdo oficial. Aplicar Portal, migration e CMS é uma operação coordenada:
Portal consumidor V1/V2/V3 primeiro, migration depois e CMS Admin/API produtores
por último, sem publicar matéria durante a janela intermediária. Faça smoke de
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
