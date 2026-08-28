# Rollout do CMS e corte do Nite News

## Limite deste runbook

Este documento prepara o lançamento das aplicações separadas `apps/admin` e
`apps/web`. Ele não autoriza migração, deploy ou alteração de secrets em
produção. Execute primeiro em homologação, com backup e responsável operacional
definidos.

## Pré-requisitos

- Dois projetos de aplicação, com raízes `apps/admin` e `apps/web`; no provedor
  de deploy, habilite a inclusão dos packages do workspace que ficam fora de
  cada raiz.
- PostgreSQL/Neon com conexões SSL e três logins separados para migration,
  Admin e portal.
- Tenant e aplicação Microsoft Entra configurados para o domínio do Admin.
- Bucket R2 com CORS de upload limitado à origem do Admin e leitura pública só
  para o prefixo processado.
- Uma matéria real, aprovada e autorizada para o smoke test público.
- Um secret aleatório compartilhado exclusivamente pela revalidação e outro
  secret exclusivo do cron.

## Configuração por aplicação

### Migration

- `DATABASE_MIGRATION_URL`: login com ownership/DDL e permissão para criar os
  group roles `nite_admin` e `nite_public`.

Com a variável disponível somente no ambiente do operador, execute da raiz:

```text
npm run db:migrate
```

O comando aplica migrations pendentes; não execute DDL manual concorrente.
Depois, crie os logins de runtime fora do repositório e conceda membership nos
group roles correspondentes.

### Admin

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
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`
- `WEB_REVALIDATION_URL`: URL HTTPS exata de
  `/api/revalidate/news` no projeto Web.
- `REVALIDATION_SECRET`: pelo menos 32 caracteres, idêntico no Admin e Web.
- `CRON_SECRET`: pelo menos 32 caracteres.

O cron versionado chama `/api/cron/outbox` diariamente às `06:00 UTC`. A
tentativa em `after()` normalmente processa o evento logo após a publicação; o
cron é a recuperação durável e, no plano Hobby, pode iniciar em qualquer ponto
dentro dessa hora. Portanto, sem um agendador mais frequente, a recuperação de
uma indisponibilidade prolongada pode levar até o próximo ciclo diário.

### Web

- `DATABASE_PUBLIC_URL`
- `R2_PUBLIC_BASE_URL`
- `REVALIDATION_SECRET`: o mesmo valor configurado no Admin.
- `NITE_NEWS_SOURCE=database` é opcional, pois `database` é o padrão.

`NITE_NEWS_SOURCE=static` é reservado a teste, desenvolvimento local e
rollback. Não há fallback automático quando banco ou configuração falham.

## Ordem de rollout em homologação

1. Faça backup e aplique `npm run db:migrate` com a credencial de migration.
2. Verifique que o login público lê `published_articles`, mas não as
   tabelas-base; verifique que o login Admin escreve apenas pelo papel previsto.
3. Faça deploy do Web e do Admin com seus conjuntos separados de variáveis.
4. Entre com a identidade cujo `oid` foi autorizado para bootstrap e confirme a
   membership `admin` pelo par `tid + oid`.
5. Envie uma imagem de teste autorizada; confirme processamento WebP e estado
   `ready` antes de publicar.
6. Crie, salve, abra preview e publique uma matéria aprovada.
7. Confirme, nessa ordem: revisão publicada, audit event, outbox `succeeded`,
   resposta pública do slug, canonical/robots/JSON-LD e entrada no sitemap.
8. Force uma falha temporária no endpoint em homologação, publique outro item e
   confirme `failed`, `next_attempt_at`, novo claim e sucesso posterior.
9. Acione o endpoint do cron com e sem o Bearer correto; espere `200` e `401`,
   respectivamente, sem expor o secret em logs.

## Corte de produção

O corte só está liberado quando os nove passos de homologação passaram e existe
conteúdo oficial publicado. Aplique as migrations, publique primeiro o Admin e
depois o Web com a fonte `database`. Faça smoke test de `/atualizacoes`, de um
slug, do sitemap e da revalidação após uma nova publicação. Monitore falhas da
outbox, tentativas acumuladas, latência de revalidação e erros de leitura da
view.

## Rollback

1. Configure temporariamente `NITE_NEWS_SOURCE=static` no Web e faça novo
   deploy; isso restaura somente os registros demonstrativos e não remove dados.
2. Suspenda novas publicações no Admin enquanto a causa é investigada.
3. Não reverta migrations automaticamente: elas são aditivas e podem conter
   dados editoriais já publicados.
4. Preserve outbox e auditoria para replay e diagnóstico. Depois da correção,
   restaure a fonte `database`, reprocesse os eventos pendentes e repita o smoke
   test antes de reabrir o fluxo editorial.
