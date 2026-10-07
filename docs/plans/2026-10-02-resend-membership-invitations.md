# Resend Membership Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** enviar convites formais em texto puro pelo Resend, exigir aceite
explícito seguido de autenticação Entra e registrar o ciclo de entrega por
webhooks assinados.

**Architecture:** a criação ou substituição do convite grava um evento na outbox
na mesma transação. O Admin processa o envio de forma idempotente, registra a
entrega separadamente e recebe os eventos do Resend por um webhook assinado; o
link do e-mail apenas inicia um aceite que só cria membership após autenticação
com o mesmo endereço institucional.

**Tech Stack:** TypeScript estrito, Next.js 16 App Router, Better Auth/Entra,
PostgreSQL/Drizzle, Vitest/PGlite, Resend Node SDK e Turbo/npm
workspaces.

**Spec:** `docs/specs/2026-10-02-resend-membership-invitations.md`

## Global Constraints

- Remetente: `CMS NITE <acesso@notify.nite.tec.br>`.
- Domínio transacional: `notify.nite.tec.br`, região Resend `sa-east-1`.
- Conteúdo exclusivamente plain text, assunto
  `Convite para integrar a equipe do CMS NITE`, sem papel ou nível de acesso.
- O nome do responsável vem de `cms_memberships.display_name`; não hardcode.
- O link não concede acesso sozinho: convite pendente, assinatura válida e
  identidade Entra com o mesmo e-mail são obrigatórios.
- A indisponibilidade do Resend não reverte a criação do convite.
- Não persistir payload bruto de webhook, API key, signing secret ou token raw.
- `packages/db` não depende de `packages/editorial`; JSONB persiste como
  `unknown` e é validado fora da camada de banco.
- Não executar migration, deploy, alteração DNS, criação de webhook ou envio
  real sem uma autorização operacional posterior e explícita.
- Preservar as alterações locais preexistentes. Antes de cada commit, comparar
  o diff com o baseline atual e incluir somente hunks da funcionalidade; se um
  hunk não puder ser isolado com segurança, deixá-lo sem commit e reportar.
- Implementar cada comportamento por TDD: teste falhando pelo motivo esperado,
  implementação mínima e teste verde antes de avançar.

## Review Focus

- Scanner que apenas faz `GET` no link não pode alterar convite nem criar
  membership; teste na Task 4.
- Login direto com e-mail convidado, sem contexto de aceite, deve continuar
  proibido; teste na Task 2.
- Resend aceitar o envio e a gravação local falhar não pode produzir e-mail
  duplicado no retry; teste na Task 5 com a mesma chave e payload.
- Webhook chegar antes da persistência do `provider_message_id` deve correlacionar
  pela tag de entrega; teste na Task 6.
- Evento duplicado ou fora de ordem não pode regredir `delivered` para `sent`;
  teste na Task 6.

---

### Task 1: Schema de convites e entregas

**Arquivos:**

- Modificar: `packages/db/src/schema.ts`
- Modificar: `packages/db/src/database.test.ts`
- Modificar: `packages/db/src/drizzle-snapshot.test.ts`
- Gerar: `packages/db/drizzle/0015_*.sql`
- Gerar: `packages/db/drizzle/meta/0015_snapshot.json`
- Modificar: `packages/db/drizzle/meta/_journal.json`

**Interfaces:**

- Produz: `cmsMembershipInvitations.linkNonce`.
- Produz: `emailDeliveries`, `emailDeliveryEvents` e seus tipos inferidos.
- Produz: status `pending | sent | delivered | bounced | complained | failed`.

- [ ] **Step 1: escrever os testes de schema que falham**

Adicionar casos que migram um PGlite vazio e comprovam:

```ts
expect(invitation.linkNonce).toEqual(expect.any(String));
expect(delivery.status).toBe("pending");
expect(duplicateOutboxEventInsert).rejects.toThrow();
expect(duplicateProviderEventInsert).rejects.toThrow();
```

Cobrir também FKs, unicidade de `provider_message_id` quando não nulo e checks
dos estados. Exigir uma única entrega por `invitation_id` e por
`outbox_event_id`.

- [ ] **Step 2: executar e observar RED**

Run:
`npm run test --workspace=@nite/cms-db -- src/database.test.ts src/drizzle-snapshot.test.ts`

Expected: FAIL porque colunas/tabelas/migration ainda não existem.

- [ ] **Step 3: implementar o schema mínimo**

Adicionar `linkNonce: uuid("link_nonce").defaultRandom().notNull()` ao convite.
Criar enums/tabelas/índices conforme a spec, com referências `restrict` para
convite/outbox e `cascade` de eventos apenas em relação à entrega. Exportar os
tipos inferidos sem criar dependência com o domínio.

- [ ] **Step 4: gerar e revisar a migration**

Run: `npm run db:generate --workspace=@nite/cms-db`

Confirmar que a migration é aditiva, preenche `link_nonce` para linhas
existentes e não altera migrations históricas.

- [ ] **Step 5: executar GREEN**

Run:
`npm run test --workspace=@nite/cms-db -- src/database.test.ts src/drizzle-snapshot.test.ts`

Expected: PASS.

- [ ] **Step 6: criar checkpoint isolado**

Revisar `git diff --cached --name-status` antes do commit. Commit esperado:
`feat(db): adicionar rastreamento de entregas de convite`.

### Task 2: Outbox atômica e aceite explícito no domínio

**Arquivos:**

- Modificar: `packages/editorial/src/identity.ts`
- Modificar: `packages/editorial/src/invitation.test.ts`
- Modificar: `packages/editorial/src/identity.test.ts`
- Modificar: `packages/editorial/src/membership.postgres.test.ts`

**Interfaces:**

- Consome: `cmsMembershipInvitations.linkNonce`, `outboxEvents`.
- Produz:
  `resolveCmsMembership(database, identity, bootstrap, context?: { invitationId?: string }): Promise<CmsMembership>`.
- Produz eventos `membership.invitation.email.requested` com
  `aggregateId === invitation.id` e payload `{ invitationId }`.

- [ ] **Step 1: escrever testes RED da criação/substituição**

Nos testes de convite, exigir que criação e substituição gravem exatamente um
evento novo na mesma transação:

```ts
expect(event).toMatchObject({
  topic: "membership.invitation.email.requested",
  aggregateId: invitation.id,
  payload: { invitationId: invitation.id },
});
```

Adicionar trigger de teste que rejeita insert na outbox e comprovar rollback do
convite e da auditoria.

- [ ] **Step 2: executar e observar RED**

Run: `npm run test --workspace=@nite/editorial -- src/invitation.test.ts`

Expected: FAIL pela ausência do evento e da atomicidade exigida.

- [ ] **Step 3: gravar o evento nas transações existentes**

Alterar criação e substituição sem mover validação, RBAC ou auditoria para fora
da transação. Revogação não gera novo e-mail.

- [ ] **Step 4: executar GREEN da outbox de convite**

Run: `npm run test --workspace=@nite/editorial -- src/invitation.test.ts`

Expected: PASS.

- [ ] **Step 5: escrever testes RED do aceite autenticado**

Em `identity.test.ts`, fixar estes comportamentos:

```ts
await expect(
  resolveCmsMembership(db, invitedIdentity, bootstrap),
).rejects.toBeInstanceOf(CmsAuthorizationError);

await expect(
  resolveCmsMembership(db, invitedIdentity, bootstrap, {
    invitationId: invitation.id,
  }),
).resolves.toMatchObject({ email: invitation.email, role: invitation.role });
```

Adicionar casos de ID inexistente, tenant diferente, e-mail diferente,
revogado, expirado, concorrência e bootstrap sem convite.

- [ ] **Step 6: executar e observar RED**

Run: `npm run test --workspace=@nite/editorial -- src/identity.test.ts`

Expected: FAIL porque o login direto ainda consome convite por e-mail.

- [ ] **Step 7: exigir o ID de aceite para memberships novas**

Manter atualização de membership existente e bootstrap inalterados. Para uma
identidade nova, consultar e travar exclusivamente o convite indicado,
revalidar tenant/e-mail/status/expiração e preservar a criação de membership,
aceite e auditoria na mesma transação.

- [ ] **Step 8: executar testes de domínio e PostgreSQL configurado**

Run:
`npm run test --workspace=@nite/editorial -- src/identity.test.ts src/invitation.test.ts`

Se `.env.postgres.local` estiver configurado, run:
`npm run test:postgres:local --workspace=@nite/editorial`.

Expected: testes aplicáveis PASS; skip do PostgreSQL deve ser reportado, não
tratado como execução.

- [ ] **Step 9: criar checkpoint isolado**

Commit esperado: `feat(editorial): exigir aceite para convites de equipe`.

### Task 3: Configuração e assinatura dos links

**Arquivos:**

- Criar: `apps/admin/src/lib/invitation-link.ts`
- Criar: `apps/admin/src/lib/invitation-link.test.ts`
- Criar: `apps/admin/src/lib/email-config.ts`
- Criar: `apps/admin/src/lib/email-config.test.ts`
- Modificar: `apps/admin/src/lib/health.ts`
- Modificar: `apps/admin/src/lib/health.test.ts`
- Modificar: `apps/admin/.env.example`
- Modificar: `deploy/vm/admin.env.example`

**Interfaces:**

- Produz:
  `createInvitationSignature(input: InvitationLinkClaims, secret: string): string`.
- Produz:
  `verifyInvitationSignature(input: InvitationLinkClaims, signature: string, secret: string): boolean`.
- Produz:
  `buildInvitationAcceptUrl(input: InvitationLinkClaims, configuration: InvitationLinkConfiguration): URL`.
- Produz `readEmailConfiguration(environment)` com API key, webhook secret,
  remetente, URL pública e secret do link.

- [ ] **Step 1: escrever testes RED de configuração e criptografia**

Cobrir configuração ausente sem revelar valores, URL HTTPS fora de localhost,
assinatura estável e comparação constante. Exigir falha para assinatura
alterada, secret curto, nonce/tenant/expiração diferentes e URL pública com
credenciais embutidas.

- [ ] **Step 2: executar e observar RED**

Run:
`npm run test --workspace=@nite/admin -- src/lib/invitation-link.test.ts src/lib/email-config.test.ts`

Expected: FAIL porque os módulos ainda não existem.

- [ ] **Step 3: implementar os módulos puros**

Usar `createHmac("sha256", secret)` e `timingSafeEqual`. Canonicalizar os claims
em uma sequência fixa e produzir assinatura base64url. Não reutilizar
`BETTER_AUTH_SECRET`, `CRON_SECRET` ou `RESEND_WEBHOOK_SECRET`.

- [ ] **Step 4: integrar readiness sem bloquear outros processadores da outbox**

O health deve falhar genericamente quando a configuração de e-mail estiver
incompleta. `processCmsOutbox` continuará exigindo globalmente apenas o banco;
configuração Resend será avaliada de forma lazy somente no tópico de e-mail,
para não impedir purges de mídia.

- [ ] **Step 5: executar GREEN**

Run:
`npm run test --workspace=@nite/admin -- src/lib/invitation-link.test.ts src/lib/email-config.test.ts src/lib/health.test.ts`

Expected: PASS.

- [ ] **Step 6: criar checkpoint isolado**

Commit esperado: `feat(admin): configurar links assinados de convite`.

### Task 4: Página de aceite e conclusão da autenticação

**Arquivos:**

- Criar: `apps/admin/src/lib/invitation-acceptance.ts`
- Criar: `apps/admin/src/lib/invitation-acceptance.test.ts`
- Criar: `apps/admin/src/app/invitations/accept/start/route.ts`
- Criar: `apps/admin/src/app/invitations/accept/start/route.test.ts`
- Criar: `apps/admin/src/app/invitations/accept/page.tsx`
- Criar: `apps/admin/src/app/invitations/accept/page.test.tsx`
- Criar: `apps/admin/src/app/invitations/accept/accept-button.tsx`
- Criar: `apps/admin/src/app/invitations/complete/route.ts`
- Criar: `apps/admin/src/app/invitations/complete/route.test.ts`
- Modificar: `apps/admin/src/lib/auth.ts`
- Modificar: `apps/admin/src/app/login/page.tsx`

**Interfaces:**

- Consome: assinatura da Task 3 e `resolveCmsMembership` da Task 2.
- Produz cookie `nite-cms.invitation-acceptance` com referência assinada,
  `HttpOnly`, `Secure` em produção, `SameSite=Lax` e expiração limitada ao
  convite.
- Produz URL pública inicial `/invitations/accept/start` e callback autenticado
  `/invitations/complete`.

- [ ] **Step 1: escrever teste RED contra consumo por `GET`**

O teste da rota inicial deve comprovar que `GET` válido apenas define o cookie e
redireciona, sem modificar `status`, `acceptedAt` ou criar membership. Casos
inválido, revogado e expirado redirecionam para mensagem genérica e não criam
cookie.

- [ ] **Step 2: executar e observar RED**

Run:
`npm run test --workspace=@nite/admin -- src/app/invitations/accept/start/route.test.ts`

Expected: FAIL pela rota inexistente.

- [ ] **Step 3: implementar validação pública e cookie**

Consultar somente ID, tenant, nonce, expiração, status e responsável necessários
à tela. Validar assinatura antes de expor dados. Redirecionar para URL limpa
`/invitations/accept`.

- [ ] **Step 4: escrever testes RED da página e do botão**

Exigir texto formal, nome do responsável, expiração em `America/Bahia`, ausência
de role e botão `Aceitar convite`. O botão inicia Microsoft social sign-in com
`callbackURL: "/invitations/complete"`; scanners que só carregam a página não
acionam a chamada.

- [ ] **Step 5: implementar página e botão mínimos**

Reutilizar o cliente Better Auth e componentes de `@nite/cms-ui`. Não criar uma
segunda sessão ou fluxo OAuth paralelo.

- [ ] **Step 6: escrever testes RED da conclusão**

Cobrir sessão ausente, assinatura inválida, convite expirado/revogado, e-mail
diferente, falha transitória e sucesso. No sucesso, exigir uma membership, convite
`accepted`, cookie removido e redirect `/`. Em falha definitiva, cookie removido;
em falha transitória de banco, responder `503` e preservá-lo.

- [ ] **Step 7: implementar conclusão autenticada**

Extrair a identidade Microsoft com os mesmos checks atuais de issuer/tenant,
revalidar o contexto e chamar `resolveCmsMembership(..., { invitationId })`.
Não afrouxar bootstrap nem o caminho de memberships existentes.

- [ ] **Step 8: executar GREEN do fluxo**

Run:
`npm run test --workspace=@nite/admin -- src/lib/invitation-acceptance.test.ts src/app/invitations/accept/start/route.test.ts src/app/invitations/accept/page.test.tsx src/app/invitations/complete/route.test.ts`

Expected: PASS.

- [ ] **Step 9: criar checkpoint isolado**

Commit esperado: `feat(admin): adicionar aceite autenticado de convite`.

### Task 5: Mensagem plain text e envio idempotente

**Arquivos:**

- Modificar: `apps/admin/package.json`
- Modificar: `package-lock.json`
- Criar: `apps/admin/src/lib/resend-email.ts`
- Criar: `apps/admin/src/lib/resend-email.test.ts`
- Criar: `apps/admin/src/lib/membership-invitation-email.ts`
- Criar: `apps/admin/src/lib/membership-invitation-email.test.ts`
- Criar: `packages/editorial/src/email-delivery.ts`
- Criar: `packages/editorial/src/email-delivery.test.ts`
- Modificar: `packages/editorial/src/index.ts`

**Interfaces:**

- Produz `InvitationEmailProvider.send(input, { idempotencyKey }): Promise<{ id: string }>`.
- Produz:
  `buildMembershipInvitationEmail(input: MembershipInvitationEmailInput): PlainTextEmail`.
- Produz operações de domínio para criar entrega, registrar aceite do provedor e
  marcar falha permanente.

- [ ] **Step 1: instalar somente o SDK oficial necessário**

Run: `npm install resend --workspace=@nite/admin`

Revisar package/lock e confirmar que nenhuma outra dependência direta foi
adicionada. O SDK será usado tanto para envio quanto para verificação Svix do
webhook.

- [ ] **Step 2: escrever testes RED do texto**

Fixar assunto e parágrafos aprovados. Exigir nome do responsável, expiração em
Salvador, URL assinada e ausência de `admin`, `publisher`, “administrativo” e
“editorial” no assunto/corpo.

- [ ] **Step 3: executar e observar RED**

Run:
`npm run test --workspace=@nite/admin -- src/lib/membership-invitation-email.test.ts`

Expected: FAIL pelo builder inexistente.

- [ ] **Step 4: implementar builder puro e adaptador Resend**

O adaptador recebe a configuração por injeção, envia apenas `text`, desabilita
tracking e retorna erro tipado como transitório ou permanente sem registrar
payload/secrets.

- [ ] **Step 5: escrever testes RED de persistência e retry**

Cobrir criação idempotente por `outbox_event_id`, tag com `delivery_id`, mesma
chave/payload em retry, sucesso com `provider_message_id`, `429/5xx/timeout`
transitórios e `4xx` permanente. Simular “Resend aceitou, update local falhou” e
exigir segunda chamada com a mesma chave e payload.

- [ ] **Step 6: implementar as operações mínimas de entrega**

Criar a linha antes da chamada externa. Encerrar determinísticamente convites
revogados/aceitos/expirados. Em falha permanente, marcar `failed` e permitir que
a outbox conclua; em transitória, lançar para o backoff existente.

- [ ] **Step 7: executar GREEN**

Run:
`npm run test --workspace=@nite/editorial -- src/email-delivery.test.ts && npm run test --workspace=@nite/admin -- src/lib/resend-email.test.ts src/lib/membership-invitation-email.test.ts`

Expected: PASS.

- [ ] **Step 8: criar checkpoint isolado**

Commit esperado: `feat(admin): enviar convites plain text pelo Resend`.

### Task 6: Webhook assinado e estados de entrega

**Arquivos:**

- Criar: `apps/admin/src/lib/resend-webhook.ts`
- Criar: `apps/admin/src/lib/resend-webhook.test.ts`
- Criar: `apps/admin/src/app/api/webhooks/resend/route.ts`
- Criar: `apps/admin/src/app/api/webhooks/resend/route.test.ts`
- Modificar: `packages/editorial/src/email-delivery.ts`
- Modificar: `packages/editorial/src/email-delivery.test.ts`

**Interfaces:**

- Consome: `resend.webhooks.verify`, corpo raw e headers `svix-*`.
- Produz:
  `recordEmailDeliveryEvent(database, event): Promise<"recorded" | "duplicate" | "unmatched">`.

- [ ] **Step 1: escrever testes RED de assinatura e parsing**

Exigir `request.text()` antes de parsing, rejeição `400` para assinatura/payload
inválido e ausência de gravação nesses casos. Mapear `sent`, `delivered`,
`bounced`, `complained`, `failed` e `suppressed -> failed`; eventos irrelevantes
retornam `2xx`.

- [ ] **Step 2: executar e observar RED**

Run:
`npm run test --workspace=@nite/admin -- src/lib/resend-webhook.test.ts src/app/api/webhooks/resend/route.test.ts`

Expected: FAIL pelos módulos inexistentes.

- [ ] **Step 3: escrever testes RED de idempotência/ordenação**

No domínio, exigir:

```ts
expect(await record(event)).toBe("recorded");
expect(await record(event)).toBe("duplicate");
expect(delivery.status).toBe("delivered"); // após sent fora de ordem
```

Adicionar webhook sem `provider_message_id` persistido, mas com tag
`delivery_id`, e exigir correlação. Um ID/tag desconhecido retorna `unmatched`
sem vazar sua existência.

- [ ] **Step 4: implementar transação e máquina de estados monotônica**

Inserir evento e atualizar entrega na mesma transação. Estados terminais não
regridem; eventos anteriores a `lastProviderEventAt` ficam registrados, mas não
alteram o estado corrente. Sanitizar razões antes de persistir.

- [ ] **Step 5: implementar rota rápida e fail-closed**

Retornar `2xx` para válido/duplicado/irrelevante, `400` para assinatura ou
schema inválido e `503` para falha transitória de banco. Não registrar corpo,
headers de assinatura nem destinatário completo.

- [ ] **Step 6: executar GREEN**

Run:
`npm run test --workspace=@nite/editorial -- src/email-delivery.test.ts && npm run test --workspace=@nite/admin -- src/lib/resend-webhook.test.ts src/app/api/webhooks/resend/route.test.ts`

Expected: PASS.

- [ ] **Step 7: criar checkpoint isolado**

Commit esperado: `feat(admin): registrar webhooks de entrega do Resend`.

### Task 7: Dispatcher da outbox e processamento imediato

**Arquivos:**

- Modificar: `apps/admin/src/lib/outbox.ts`
- Modificar: `apps/admin/src/lib/outbox-processing.test.ts`
- Modificar: `apps/admin/src/app/(workspace)/memberships/actions.ts`
- Criar: `apps/admin/src/app/(workspace)/memberships/actions.test.ts`

**Interfaces:**

- Consome: builder/provider da Task 5.
- Produz suporte ao tópico `membership.invitation.email.requested` no dispatcher
  existente.

- [ ] **Step 1: escrever teste RED do novo tópico**

Exigir que o dispatcher encaminhe somente esse tópico ao serviço de convite,
preserve mídia e os eventos editoriais legados atuais e rejeite tópico
desconhecido.

- [ ] **Step 2: executar e observar RED**

Run:
`npm run test --workspace=@nite/admin -- src/lib/outbox-processing.test.ts`

Expected: FAIL porque o tópico ainda não é suportado.

- [ ] **Step 3: integrar o dispatcher de e-mail sem sobrescrever o WIP existente**

Adicionar uma dependência injetável/lazy para e-mail. Notícias são lidas sob
demanda pela API pública `no-store`, portanto não adicionar dispatcher ou
webhook de revalidação editorial. Não alterar os contratos de purge de mídia.

- [ ] **Step 4: escrever teste RED do best-effort pós-commit**

Nas Server Actions, exigir que `processCmsOutbox()` seja chamado somente depois
de `createCmsMembershipInvitation`/`replaceCmsMembershipInvitation` resolverem.
Falha do processador deve manter resposta de sucesso do convite; falha na criação
não chama o processador.

- [ ] **Step 5: implementar processamento imediato**

Reutilizar o padrão best-effort já adotado nas ações editoriais, aguardar a
tentativa antes de `revalidatePath` e manter o scheduler como fallback.

- [ ] **Step 6: executar GREEN**

Run:
`npm run test --workspace=@nite/admin -- src/lib/outbox-processing.test.ts 'src/app/(workspace)/memberships/actions.test.ts'`

Expected: PASS.

- [ ] **Step 7: criar checkpoint isolado**

Como os arquivos já possuem alterações não relacionadas, stagear exclusivamente
os novos hunks e confirmar o cached diff. Commit esperado:
`feat(admin): processar emails de convite pela outbox`.

### Task 8: Estado de entrega no painel

**Arquivos:**

- Modificar: `apps/admin/src/app/(workspace)/memberships/page.tsx`
- Modificar: `apps/admin/src/app/(workspace)/memberships/page.test.tsx`
- Modificar: `apps/admin/src/components/memberships/memberships.types.ts`
- Modificar: `apps/admin/src/components/memberships/membership-invitations.tsx`
- Modificar: `apps/admin/src/components/memberships-panel.test.tsx`

**Interfaces:**

- Consome: `emailDeliveries.status` da Task 1.
- Produz `deliveryStatus` opcional em `MembershipInvitation` e seus rótulos
  públicos.

- [ ] **Step 1: escrever testes RED da query e apresentação**

Exigir associação por `invitation_id` e os rótulos:

```ts
pending/undefined -> "Aguardando envio"
sent -> "Enviado"
delivered -> "Entregue"
bounced -> "Devolvido"
complained -> "Marcado como spam"
failed -> "Falha no envio"
```

- [ ] **Step 2: executar e observar RED**

Run:
`npm run test --workspace=@nite/admin -- 'src/app/(workspace)/memberships/page.test.tsx' src/components/memberships-panel.test.tsx`

Expected: FAIL porque a query/tipo/UI não expõem entrega.

- [ ] **Step 3: implementar join e rótulos mínimos**

Manter o papel visível somente no painel administrativo existente; a restrição
de ocultá-lo aplica-se ao e-mail e à página pública de aceite.

- [ ] **Step 4: executar GREEN e acessibilidade básica**

Run:
`npm run test --workspace=@nite/admin -- 'src/app/(workspace)/memberships/page.test.tsx' src/components/memberships-panel.test.tsx`

Expected: PASS, com estados legíveis sem depender apenas de cor.

- [ ] **Step 5: criar checkpoint isolado**

Commit esperado: `feat(admin): exibir entrega dos convites`.

### Task 9: Operação e documentação do Resend

**Arquivos:**

- Criar: `docs/runbooks/resend-membership-invitations.md`
- Modificar: `docs/runbooks/cms-rollout.md`
- Modificar: `README.md` se houver índice de runbooks aplicável

**Interfaces:** nenhuma de runtime.

- [ ] **Step 1: documentar preparação sem executar produção**

Registrar criação do domínio `notify.nite.tec.br` em `sa-east-1`, SPF/DKIM,
DMARC institucional, API key restrita ao domínio, webhook com eventos
necessários, armazenamento imediato do signing secret e variáveis da VM.

- [ ] **Step 2: documentar rollout e rollback**

Ordem: verificar convites pendentes legados, configurar e verificar domínio,
criar API key e webhook, salvar seus secrets, aplicar migration manual, publicar
código, verificar health, testar os endereços oficiais do Resend e só então
enviar convite controlado. Rollback desabilita webhook e secrets sem remover
histórico; migration reversa fica fora do procedimento.

- [ ] **Step 3: validar documentação**

Run:
`npm exec prettier -- --check docs/runbooks/resend-membership-invitations.md docs/runbooks/cms-rollout.md README.md`

Run: `git diff --check`.

Expected: PASS e nenhuma credencial real no diff.

- [ ] **Step 4: criar checkpoint isolado**

Commit esperado: `docs: adicionar runbook de convites por Resend`.

### Task 10: Validação final e preparação operacional

**Arquivos:** todos os arquivos alterados nas Tasks 1–9.

**Interfaces:** valida o sistema integrado; não cria nova interface.

- [ ] **Step 1: executar validações direcionadas finais**

Run:

```powershell
npm run test --workspace=@nite/cms-db
npm run test --workspace=@nite/editorial
npm run test --workspace=@nite/admin
npm run lint --workspace=@nite/cms-db
npm run lint --workspace=@nite/editorial
npm run lint --workspace=@nite/admin
npm run typecheck --workspace=@nite/cms-db
npm run typecheck --workspace=@nite/editorial
npm run typecheck --workspace=@nite/admin
npm run build --workspace=@nite/admin
```

Expected: PASS; skips e falhas preexistentes devem ser discriminados.

- [ ] **Step 2: executar `npm run check` uma vez no estado final**

Expected: PASS. Se o check parar em problema preexistente, provar com o diff e
reportar o comando/erro sem mascará-lo.

- [ ] **Step 3: revisar segurança e working tree**

Run: `git diff --check` e busca por padrões `re_`, `whsec_`, API keys, secrets,
corpos de webhook e logs indevidos. Confirmar que commits não incorporaram as
alterações preexistentes.

- [ ] **Step 4: revisão independente final**

Revisar migration, RBAC, token/cookie, assinatura raw do webhook, idempotência,
transições de estado e falhas parciais contra a spec.

- [ ] **Step 5: encerrar somente a implementação local**

Relatar arquivos, testes, riscos e pendências. Solicitar autorização separada
antes de migration, DNS, criação de domínio/webhook, secrets, deploy ou envio
real. Não afirmar validação operacional do Resend sem executar essa fase.
