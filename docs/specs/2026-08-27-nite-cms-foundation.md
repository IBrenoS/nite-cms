# Fundação do CMS NITE

**Status:** implementação local das etapas 1–8 concluída; provisionamento pendente
**Escopo desta entrega:** contrato, persistência, fronteiras, admin, autenticação, editor, mídia, preview, publicação transacional, auditoria, outbox, cron, revalidação e leitura pública pela view
**Fora desta entrega:** provisionamento/deploy, conteúdo oficial e validação E2E com Entra, Neon, R2 e domínios reais

## Objetivo

Criar a fundação de um CMS editorial próprio para o Nite News sem acoplar o
portal público a detalhes administrativos. O CMS pertence ao mesmo produto e ao
mesmo monorepo como aplicação separada. O contrato de domínio continua
centralizado em `@nite/content`.

## Topologia aprovada

```text
apps/web                         apps/admin
   │ leitura publicada               │ leitura e escrita autenticadas
   └──────────────┬───────────────────┘
                  ▼
           @nite/content
      ┌───────────┴───────────┐
      │                       │
@nite/content/public   @nite/content/admin
      │                       │
      └───────────┬───────────┘
                  ▼
        Neon PostgreSQL + Drizzle
```

Não foram criados `apps/api`, `packages/db` ou `packages/auth`: Route Handlers e
Server Actions de `apps/admin` formam a camada HTTP. `packages/ui` foi extraído
quando web e admin passaram a compartilhar tokens, primitives e o renderer do
corpo editorial.

## Fronteiras do package

- `@nite/content`: tipos e domínios compartilhados, além das APIs legadas de
  projetos, pessoas e linha do tempo.
- `@nite/content/public`: consultas assíncronas que só retornam o read model
  publicado. O portal público importa News exclusivamente desta entrada.
- `@nite/content/admin`: schema Drizzle e contratos administrativos. Esta
  entrada nunca pode ser importada por `apps/web`.

As regras de publicação, ordenação, filtros, resolução por slug e indexação
permanecem no package. O portal usa o adapter PostgreSQL e lê somente a view
`published_articles`. O adapter local mantém os oito registros demonstrativos
apenas quando `NITE_NEWS_SOURCE=static` é escolhido explicitamente.

## Persistência

### Entidades

- `articles`: identidade estável, slug, estado e ponteiros para as revisões
  atual e publicada.
- `article_revisions`: snapshots imutáveis do conteúdo; cada salvamento
  explícito cria uma versão crescente.
- `media_assets`: metadados de objetos armazenados; o banco não armazena o
  arquivo binário.
- `cms_memberships`: vínculo de uma identidade externa com papel editorial.
- `audit_events`: trilha append-only das ações relevantes.
- `outbox_events`: efeitos assíncronos idempotentes, como revalidação e limpeza
  de mídia.
- `published_articles`: view de leitura pública, composta somente pela revisão
  fixada como publicada.

### Estados e invariantes

- Artigo: `draft | published | archived`.
- Membro: `admin | editor | author`.
- Mídia: `pending | ready | quarantined | failed`.
- Outbox: `pending | processing | succeeded | failed`.
- `slug` é único.
- `(article_id, version)` é único e revisões não são atualizadas.
- Um artigo publicado precisa ter `published_revision_id` e `published_at`.
- A view pública exclui rascunhos, arquivados e publicações futuras.
- O read model público deriva `public = true` e `contentState = "real"`; esses
  valores não são escolhas do painel.

O corpo editorial é JSONB versionado por `content_schema_version`. A versão 1
preserva o contrato atual de blocos do Nite News; ampliações do editor devem ser
aditivas e acompanhadas por validação/migração explícita.

## Acesso ao banco

Produção terá três credenciais independentes, nunca armazenadas no repositório:

- `DATABASE_MIGRATION_URL`: ownership/DDL e concessão de privilégios.
- `DATABASE_ADMIN_URL`: leitura e escrita nas tabelas editoriais.
- `DATABASE_PUBLIC_URL`: somente `SELECT` em `published_articles`.

As migrations criam os group roles `nite_admin` e `nite_public` como
`NOLOGIN`. O provisionamento do ambiente cria logins e concede membership; não
há senha ou secret em SQL versionado. `nite_public` não recebe privilégios nas
tabelas-base.

## Contrato de consulta assíncrona

Todas as consultas News retornam `Promise`, inclusive as atualmente atendidas
por JSON local. Isso evita uma segunda quebra de API quando a fonte padrão for
alterada para PostgreSQL. `normalizeNewsFilter` continua síncrona porque é uma
função pura sem I/O.

Uma fonte pública implementa apenas `listPublishedArticles()`. As operações de
slug, destaque, agenda, relacionadas, filtros e indexação são derivadas no
domínio, garantindo o mesmo comportamento entre o adapter transitório e o
PostgreSQL.

## Publicação, outbox e revalidação

A publicação fixa a revisão, atualiza o artigo, grava a auditoria e insere
`news.article.published` na outbox dentro de uma única transação. O evento só é
enviado depois do commit. Um disparo de baixa latência em `after()` e um cron de
recuperação usam o mesmo processador, com claim concorrente, lease, token,
limite de tentativas e backoff exponencial.

O Admin envia ao portal um payload validado e assinado sobre os bytes exatos do
corpo. O endpoint público rejeita bodies grandes, content type incorreto,
timestamp fora da janela, assinatura inválida e payload incompatível. Quando o
evento é aceito, a tag compartilhada de News e os caminhos afetados são
revalidados. O TTL de cinco minutos limita staleness mesmo se a chamada de baixa
latência falhar; a outbox mantém a recuperação durável.

## Critérios de aceite desta entrega

1. A migration roda do zero em PGlite e cria tabelas, enums, índices, roles e
   view.
2. A view devolve apenas a revisão publicada de artigos elegíveis.
3. Sob `SET ROLE nite_public`, a view pode ser lida e as tabelas-base não.
4. O adapter PostgreSQL valida o read model antes de entregá-lo ao portal.
5. `apps/web` importa News por `@nite/content/public`; ESLint bloqueia o caminho
   administrativo.
6. As páginas, metadata e sitemap aguardam as consultas assíncronas sem alterar
   URLs, metadata, JSON-LD ou layout; slugs publicados são resolvidos
   dinamicamente.
7. O portal usa a view por padrão e falha fechado quando a configuração pública
   está ausente; a fonte estática exige opt-in explícito.
8. Publicação, auditoria e criação do evento são atômicas; workers concorrentes
   não entregam o mesmo claim ativo e falhas são reagendadas.
9. Revalidação e cron são autenticados, validam entrada e não registram secrets.

## Sequência operacional posterior

1. Executar o runbook `docs/runbooks/cms-rollout.md` em homologação.
2. Provisionar banco, logins, Entra, R2, domínios e secrets fora do repositório.
3. Validar login, bootstrap, CORS, upload/processamento, publicação, auditoria,
   outbox, cron, revalidação e leitura pública.
4. Criar a primeira matéria institucional aprovada e executar o corte do portal.
5. Manter a fonte estática somente como rollback até a estabilização operacional.
