# Fundação do CMS NITE

**Status:** implementação local concluída; provisionamento e smoke test de homologação pendentes
**Escopo:** contrato, persistência, Admin, API pública v2, autenticação, memberships, editor, mídia, preview, ciclo editorial, auditoria, outbox e revalidação
**Fora do escopo:** provisionamento/deploy, conteúdo oficial, compatibilidade `/v1`, aprovação, agendamento, autosave, exclusão e validação E2E com recursos reais

## Objetivo e topologia aprovada

O CMS é um repositório independente do Portal NITE. O Portal não importa
packages, arquivos, migrations, banco ou credenciais editoriais do CMS.

```text
Portal apps/web ── HTTPS GET /v2/news ──> CMS apps/api ── SELECT ──> PostgreSQL
CMS apps/admin ── escrita autenticada ──> PostgreSQL
CMS apps/admin ── staging/processamento ──> R2 privado + R2 público/CDN
CMS apps/admin ── webhook HMAC ──> Portal /api/revalidate/news
Portal /api/preview ── HTTPS POST ──> CMS apps/admin/api/preview/resolve
```

`apps/admin` concentra Better Auth/Entra, comandos editoriais e escrita R2.
`apps/api` é read-only e publica somente a view `published_articles`.
`packages/editorial` contém o domínio; `packages/db`, schema e migrations; e
`packages/cms-ui`, a UI exclusiva do painel. Nenhum package é compartilhado
com o Portal.

## Persistência e ciclo editorial

- `articles`: identidade, slug, estado, primeira publicação e ponteiros de
  revisão.
- `article_revisions`: snapshots imutáveis; cada salvamento explícito cria uma
  nova versão.
- `media_assets`: chaves imutáveis distintas para staging e objeto público.
- `cms_memberships`: identidade Entra por `tid + oid`, papel e estado ativo.
- `cms_membership_invitations`: convites institucionais pendentes, aceitos ou
  revogados, sem exclusão.
- `audit_events`: trilha append-only.
- `outbox_events`: entrega idempotente da revalidação.
- `published_articles`: read model exclusivo da API pública.

Os estados são `draft | published | archived`. Publicar faz
`draft -> published`; despublicar, `published -> draft`; arquivar aceita draft
ou published; restaurar sempre volta para draft. Toda ação recebe
`expectedRevisionId` e conflito não produz alteração parcial. `publishedAt`
registra a primeira publicação e nunca volta a nulo; por isso o slug permanece
bloqueado depois da primeira publicação.

Publicação, despublicação e arquivamento de conteúdo público gravam auditoria e
outbox na mesma transação. O Portal invalida cache, lista, artigo, filtros e
sitemap. O worker usa claim concorrente, lease, token, tentativas e backoff.

## RBAC e memberships

Os únicos papéis são `publisher | admin`. Ambos criam, editam, salvam,
pré-visualizam, publicam, despublicam, arquivam e restauram qualquer matéria.
Somente `admin` cria convites, corrige ou revoga convites pendentes, ativa,
desativa ou troca o papel de memberships existentes.

O tenant é fixado por `MICROSOFT_TENANT_ID`. O login atualiza nome e e-mail a
partir de claims Entra verificados. Memberships são desativadas, não excluídas;
auto-desativação, auto-rebaixamento e remoção do último admin ativo são
bloqueados e toda alteração gera auditoria.

O primeiro acesso de uma nova pessoa começa por convite ao e-mail exato no
domínio `@unijorge.com`, válido por 7 dias. O CMS não envia mensagens: a pessoa
é avisada pelo responsável e entra normalmente com a conta Microsoft. Após
validar provider, issuer, tenant e e-mail autenticado, o aceite cria a
membership e vincula definitivamente o `oid` real em uma única transação.
Logins posteriores usam exclusivamente `tid + oid`; o e-mail deixa de ser
identificador de autorização e pode apenas sincronizar o perfil. Corrigir um
convite revoga o registro anterior e cria outro ligado ao histórico. O fluxo
não consulta Microsoft Graph nem requer `User.Read.All`.

## Contrato editorial v2

A API expõe `GET /v2/news` e `GET /v2/news/{slug}` com envelope
`version: 2`. Não existe rota ou payload legado `/v1`.

`NewsArticle.body` é exclusivamente `EditorialDocumentV1`, com raiz
`{ schemaVersion: 1, type: "doc", content: [...] }`. O documento aceita
parágrafos, H2/H3, listas ordenadas e não ordenadas, citações e imagens; texto
pode ter bold, italic e link. Links são limitados a HTTP(S), `mailto:` e
caminhos internos seguros. HTML livre, vídeo, embeds, nós e marks desconhecidos
são rejeitados no servidor.

Imagens do AST referenciam assets `ready`; na fronteira pública, a referência é
resolvida para URL, dimensões e alt. Capa e imagens inline exigem alt. O tempo
de leitura não é entrada editorial: o servidor conta o texto visível a 200
palavras por minuto, arredonda para cima e limita a 1–30 minutos.

## Mídia em dois buckets

Uploads JPEG/PNG/WebP de até 10 MB recebem presigned URL somente para
`R2_STAGING_BUCKET`, privado e com CORS limitado ao Admin. O processamento
confere tamanho, magic bytes e MIME, normaliza orientação, remove EXIF, limita
a 2400 px, converte para WebP e grava uma chave content-addressed imutável em
`R2_PUBLIC_BUCKET`. `R2_PUBLIC_BASE_URL` serve os objetos prontos com cache
immutable.

O original é retido no staging e o MVP não requer `DeleteObject`. A migration
dos dois buckets pressupõe ausência de objetos reais legados; não existe
backfill, cópia ou fallback para `object_key`.

## Preview privado

O Admin assina por `PREVIEW_HMAC_SECRET` um token de até dez minutos contendo
`articleId`, `revisionId`, `expiresAt` e `nonce`, e monta a entrada do Portal a
partir de `PORTAL_PREVIEW_URL`. `POST /api/preview/resolve` verifica assinatura
e expiração, carrega exatamente a revisão indicada, resolve mídia e responde
sempre `private, no-store`.

O Portal encaminha o mesmo token ao resolver do Admin por
`CMS_PREVIEW_RESOLVE_URL`. O secret HMAC nunca é entregue ao Portal. Token
inválido, expirado, adulterado ou sem revisão não habilita Draft Mode.

## Banco e credenciais

- `DATABASE_MIGRATION_URL`: ownership/DDL.
- `DATABASE_ADMIN_URL`: leitura e escrita editorial.
- `DATABASE_PUBLIC_URL`: leitura somente da view pública.

As migrations criam `nite_admin` e `nite_public` como group roles `NOLOGIN`.
Logins e secrets são provisionados fora do repositório; `nite_public` não
recebe privilégios nas tabelas-base.

## Critérios de aceite local

1. Migrations partem do zero, convertem papéis defensivamente e criam as
   constraints e a view pública.
2. Permissões, proteção do último admin, transições, concorrência, auditoria e
   outbox são cobertas no domínio.
3. AST, Tiptap, links, mídia e tempo de leitura são validados no servidor.
4. A API pública publica somente v2 e conteúdo elegível.
5. Upload/processamento seleciona os dois buckets e não usa deleção.
6. Admin cobre memberships, editor, conflitos e ciclo editorial.
7. Preview resolve a revisão exata sem expor conteúdo à cache pública.

## Aceite operacional pendente

O rollout permanece bloqueado até homologar Entra autorizado/não autorizado,
PostgreSQL com os três logins, os dois buckets R2, domínios reais, API v2,
preview entre projetos, revalidação e o fluxo editorial completo. Não publicar
a primeira matéria real até CMS/API e Portal estarem no contrato v2.
