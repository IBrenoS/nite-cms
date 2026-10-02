# Fundação do CMS NITE

**Status:** implementação local concluída; provisionamento e smoke test de homologação pendentes
**Escopo:** contrato, persistência, Admin, API pública v2, autenticação, memberships, editor, mídia, preview, ciclo editorial, auditoria, outbox e convites
**Fora do escopo:** provisionamento/deploy, conteúdo oficial, compatibilidade `/v1`, aprovação, agendamento, autosave, transcodificação, streaming adaptativo e validação E2E com recursos reais

## Objetivo e topologia aprovada

O CMS é um repositório independente do Portal NITE. O Portal não importa
packages, arquivos, migrations, banco ou credenciais editoriais do CMS.

```text
Portal apps/web ── HTTPS GET /v2/news ──> CMS apps/api ── SELECT ──> PostgreSQL
CMS apps/admin ── escrita autenticada ──> PostgreSQL
CMS apps/admin ── staging/processamento ──> R2 privado + R2 público/CDN
CMS apps/admin ── HTTPS ──> Resend
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
domínio `@unijorge.com` ou `@unijorge.com.br`, válido por 7 dias. O CMS envia o
convite pelo Resend e a pessoa entra com a conta Microsoft pelo link recebido.
Após
validar provider, issuer, tenant e e-mail autenticado, o aceite cria a
membership e vincula definitivamente o `oid` real em uma única transação.
Logins posteriores usam exclusivamente `tid + oid`; o e-mail deixa de ser
identificador de autorização e pode apenas sincronizar o perfil. Corrigir um
convite revoga o registro anterior e cria outro ligado ao histórico. O fluxo
não consulta Microsoft Graph nem requer `User.Read.All`.

## Contrato editorial V1/V2/V3

A API expõe `GET /v2/news` e `GET /v2/news/{slug}` com envelope
`version: 2`. Não existe rota ou payload legado `/v1`.

`NewsArticle.body` aceita `EditorialDocumentV1`, V2 e V3, com raiz versionada
`{ schemaVersion, type: "doc", content: [...] }`. Novas revisões são gravadas
em V3; documentos anteriores permanecem legíveis e são convertidos apenas no
próximo salvamento. O documento aceita parágrafos, H2/H3, listas ordenadas e
não ordenadas, citações, imagens e, na V3, vídeos top-level; texto pode ter
bold, italic e link. Links são limitados a HTTP(S), `mailto:` e caminhos
internos seguros. HTML livre, embeds, vídeo aninhado e nós ou marks
desconhecidos são rejeitados no servidor.

Imagens do AST referenciam assets `ready`; na fronteira pública, a referência é
resolvida para URL, dimensões e alt. Em V2, imagens internas também aceitam
legenda, crédito e layout `normal | wide | full`. A capa é mídia destacada
obrigatória e separada do corpo; capa e imagens inline exigem alt, enquanto
legenda e crédito são opcionais. O tempo
de leitura não é entrada editorial: o servidor conta o texto visível a 200
palavras por minuto, arredonda para cima e limita a 1–30 minutos.

Vídeos V3 referenciam MP4 pronto, modo `autoplay | manual`, largura
`normal | wide | full` e, opcionalmente, descrição, legenda visual, crédito e
WebVTT pt-BR. Autoplay é sempre mudo, sem controles, `playsInline` e em loop;
aceita no máximo três blocos e 60 segundos por vídeo. Reprodução manual aceita
áudio e exige WebVTT quando o arquivo possui faixa sonora. Rascunhos podem
conter anexos ainda incompletos, mas preview e publicação aplicam todas essas
regras e exigem mídia `ready` do tipo correto.

## Mídia em dois buckets

Uploads JPEG/PNG/WebP de até 10 MB, MP4 de até 100 MB e WebVTT de até 1 MB
recebem presigned URL somente para
`R2_STAGING_BUCKET`, privado e com CORS limitado ao Admin. O processamento
confere tamanho, magic bytes e MIME, normaliza orientação, remove EXIF, limita
a 2400 px, converte para WebP e grava uma chave content-addressed imutável em
`R2_PUBLIC_BUCKET`. `R2_PUBLIC_BASE_URL` serve os objetos prontos com cache
immutable.

MP4 é aceito somente com vídeo H.264 `avc1`/`avc3`, no máximo uma faixa de
áudio AAC, dimensões e duração positivas e `moov` antes de `mdat` (fast-start).
Não há transcodificação, poster automático, HLS/DASH ou múltiplas qualidades.
WebVTT deve ser UTF-8, começar com `WEBVTT`, conter cue válido e terminar até a
duração do vídeo associado. Após a promoção por `CopyObject`,
`media.staging.purge` remove de forma idempotente o MP4/WebVTT temporário.

O original é retido no staging enquanto a mídia estiver referenciada. A
exclusão definitiva de uma matéria remove revisões e snapshots, preserva
auditoria/outbox e agenda `media.asset.purge` somente para assets sem qualquer
referência permanente ou temporária. O worker exclui staging e public antes de
remover `media_assets`; retries são idempotentes. Uploads órfãos há mais de 48
horas entram no mesmo fluxo pelo cron diário. Não há purge explícito do cache
CDN nesta etapa.

## Preview privado

O Admin valida o formulário atual pelo contrato publicável e persiste um
`preview_snapshot` privado por até dez minutos, sem criar revisão, auditoria ou
alterar o estado da matéria. O token HMAC v2 contém `articleId`, `snapshotId`,
`expiresAt` e `nonce`; o DTO v2 expõe também `baseRevisionId`. O endpoint
`POST /api/preview/resolve` verifica assinatura e expiração, resolve o snapshot
e suas mídias e responde sempre `private, no-store`. Tokens e DTOs v1 baseados
em `revisionId` permanecem aceitos temporariamente para rollout e rollback.

O Portal encaminha o mesmo token ao resolver do Admin por
`CMS_PREVIEW_RESOLVE_URL`. O secret HMAC nunca é entregue ao Portal. Token
inválido, expirado, adulterado ou sem revisão não habilita Draft Mode.
Snapshots expirados são removidos oportunisticamente na criação e resolução;
o cron diário do outbox garante a exclusão física em até 24 horas.

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
5. Upload/processamento seleciona os dois buckets e o outbox executa purge
   idempotente de staging ou de mídia órfã.
6. Admin cobre memberships, editor, conflitos e ciclo editorial.
7. Preview resolve a revisão exata sem expor conteúdo à cache pública.

## Aceite operacional pendente

O rollout permanece bloqueado até homologar Entra autorizado/não autorizado,
PostgreSQL com os três logins, os dois buckets R2, CORS público para MP4/WebVTT,
domínios reais, API v2, preview entre projetos, entrega de convites e o fluxo
editorial completo. Não produzir V3 até consumidor, migration 0013 e Admin/API
estarem no contrato compatível.

> Documento histórico. O fluxo atual não usa webhook de revalidação editorial; consulte [cms-rollout.md](../runbooks/cms-rollout.md).
